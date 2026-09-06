import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  assignChallengeTeamMemberBodySchema,
  buildStudentChallengeView,
  challengeAliasFor,
  contributeChallengeBodySchema,
  createChallengeTeamBodySchema,
  createClassChallengeBodySchema,
  moderateContributionBodySchema,
  normalizeEvidenceKey,
  optInChallengeBodySchema,
  patchClassChallengeBodySchema,
  patchClassSettingsBodySchema,
  patchParticipationBodySchema,
  uniqueEvidenceCountFor,
  type ChallengeContributionRecord,
  type ChallengeDisplayMode,
  type ChallengeKind,
  type ChallengeParticipantRecord,
  type ContributionStatus,
  type SessionUser,
  type StudentChallengeListItem,
  type StudentChallengeView,
  type TeacherChallengeSummary,
  type TeacherChallengeView,
} from "@jose/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  classChallengeContributions,
  classChallengeParticipants,
  classChallengeTeamMembers,
  classChallengeTeams,
  classChallenges,
  classMembers,
  classes,
  learners,
} from "../db/schema";

function parseBody<T>(
  schema: {
    safeParse: (
      data: unknown,
    ) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
  },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid body",
    );
  }
  return parsed.data;
}

@Injectable()
export class ClassChallengeService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async setClassChallengesEnabled(user: SessionUser, classId: string, enabled: boolean) {
    await this.requireOwnedClass(user, classId);
    await this.db
      .update(classes)
      .set({ challengesEnabled: enabled })
      .where(eq(classes.id, classId));
    return { ok: true, challengesEnabled: enabled };
  }

  async patchClassSettings(user: SessionUser, classId: string, body: unknown) {
    const data = parseBody(patchClassSettingsBodySchema, body);
    return this.setClassChallengesEnabled(user, classId, data.challengesEnabled);
  }

  async createChallenge(user: SessionUser, classId: string, body: unknown) {
    await this.requireOwnedClass(user, classId);
    const data = parseBody(createClassChallengeBodySchema, body);
    const id = randomUUID();
    const t = Date.now();
    await this.db.insert(classChallenges).values({
      id,
      classId,
      kind: data.kind,
      title: data.title,
      prompt: data.prompt,
      goalCount: data.goalCount,
      enabled: true,
      archivedAt: null,
      createdAt: t,
      closedAt: null,
    });
    return this.getTeacherChallenge(user, classId, id);
  }

  async listTeacherChallenges(user: SessionUser, classId: string): Promise<TeacherChallengeSummary[]> {
    await this.requireOwnedClass(user, classId);
    const rows = await this.db
      .select()
      .from(classChallenges)
      .where(and(eq(classChallenges.classId, classId), isNull(classChallenges.archivedAt)))
      .orderBy(asc(classChallenges.createdAt));
    const result: TeacherChallengeSummary[] = [];
    for (const row of rows) {
      const participants = await this.db
        .select()
        .from(classChallengeParticipants)
        .where(
          and(
            eq(classChallengeParticipants.challengeId, row.id),
            isNull(classChallengeParticipants.withdrawnAt),
          ),
        );
      const contributions = await this.loadContributionRecords(row.id);
      result.push({
        id: row.id,
        classId: row.classId,
        kind: row.kind as ChallengeKind,
        title: row.title,
        goalCount: row.goalCount,
        enabled: Boolean(row.enabled),
        archivedAt: row.archivedAt,
        createdAt: row.createdAt,
        participantCount: participants.length,
        uniqueEvidenceCount: uniqueEvidenceCountFor(contributions),
      });
    }
    return result;
  }

  async getTeacherChallenge(
    user: SessionUser,
    classId: string,
    challengeId: string,
  ): Promise<TeacherChallengeView> {
    await this.requireOwnedClass(user, classId);
    const challenge = await this.requireChallengeInClass(classId, challengeId);
    const teams = await this.loadTeams(challenge.id);
    const participantRows = await this.db
      .select()
      .from(classChallengeParticipants)
      .where(eq(classChallengeParticipants.challengeId, challenge.id));
    const participants: TeacherChallengeView["participants"] = [];
    for (const row of participantRows) {
      const [learner] = await this.db.select().from(learners).where(eq(learners.id, row.learnerId));
      participants.push({
        learnerId: row.learnerId,
        alias: row.alias,
        displayMode: row.displayMode as ChallengeDisplayMode,
        displayName: learner?.displayName ?? row.learnerId,
        optedInAt: row.optedInAt,
        withdrawnAt: row.withdrawnAt,
      });
    }
    const contributionRows = await this.db
      .select()
      .from(classChallengeContributions)
      .where(eq(classChallengeContributions.challengeId, challenge.id))
      .orderBy(asc(classChallengeContributions.createdAt));
    const contributions = contributionRows.map((row) => ({
      id: row.id,
      learnerId: row.learnerId,
      teamId: row.teamId,
      evidenceKey: row.evidenceKey,
      title: row.title,
      note: row.note,
      status: row.status as ContributionStatus,
      createdAt: row.createdAt,
    }));
    const records = await this.loadContributionRecords(challenge.id);
    const progressByTeam =
      challenge.kind === "team_case"
        ? teams.map((team) => {
            const uniqueEvidenceCount = uniqueEvidenceCountFor(records, team.id);
            return {
              teamId: team.id,
              uniqueEvidenceCount,
              goalReached: uniqueEvidenceCount >= challenge.goalCount,
            };
          })
        : [
            {
              teamId: null,
              uniqueEvidenceCount: uniqueEvidenceCountFor(records),
              goalReached: uniqueEvidenceCountFor(records) >= challenge.goalCount,
            },
          ];
    return {
      id: challenge.id,
      classId: challenge.classId,
      kind: challenge.kind as ChallengeKind,
      title: challenge.title,
      prompt: challenge.prompt,
      goalCount: challenge.goalCount,
      enabled: Boolean(challenge.enabled),
      archivedAt: challenge.archivedAt,
      createdAt: challenge.createdAt,
      closedAt: challenge.closedAt,
      teams,
      participants,
      contributions,
      progressByTeam,
    };
  }

  async patchChallenge(user: SessionUser, classId: string, challengeId: string, body: unknown) {
    await this.requireOwnedClass(user, classId);
    const challenge = await this.requireChallengeInClass(classId, challengeId);
    const data = parseBody(patchClassChallengeBodySchema, body);
    await this.db
      .update(classChallenges)
      .set({
        title: data.title ?? challenge.title,
        prompt: data.prompt ?? challenge.prompt,
        goalCount: data.goalCount ?? challenge.goalCount,
        enabled: data.enabled ?? challenge.enabled,
        archivedAt: data.archived === true ? Date.now() : data.archived === false ? null : challenge.archivedAt,
      })
      .where(eq(classChallenges.id, challenge.id));
    return this.getTeacherChallenge(user, classId, challengeId);
  }

  async createTeam(user: SessionUser, classId: string, challengeId: string, body: unknown) {
    await this.requireOwnedClass(user, classId);
    const challenge = await this.requireChallengeInClass(classId, challengeId);
    if (challenge.kind !== "team_case") {
      throw new BadRequestException("Teams are only used for teacher-moderated cases");
    }
    const data = parseBody(createChallengeTeamBodySchema, body);
    const id = randomUUID();
    await this.db.insert(classChallengeTeams).values({
      id,
      challengeId: challenge.id,
      name: data.name,
      createdAt: Date.now(),
    });
    return { id, name: data.name, memberIds: [] as string[] };
  }

  async assignTeamMember(
    user: SessionUser,
    classId: string,
    challengeId: string,
    teamId: string,
    body: unknown,
  ) {
    await this.requireOwnedClass(user, classId);
    const challenge = await this.requireChallengeInClass(classId, challengeId);
    const data = parseBody(assignChallengeTeamMemberBodySchema, body);
    const [team] = await this.db
      .select()
      .from(classChallengeTeams)
      .where(and(eq(classChallengeTeams.id, teamId), eq(classChallengeTeams.challengeId, challenge.id)));
    if (!team) throw new NotFoundException("Team not found");
    const participant = await this.activeParticipant(challenge.id, data.learnerId);
    if (!participant) {
      throw new BadRequestException("Only opted-in students can join a team case");
    }
    await this.requireClassMember(challenge.classId, data.learnerId);
    const existingTeams = await this.loadTeams(challenge.id);
    if (existingTeams.some((row) => row.memberIds.includes(data.learnerId))) {
      throw new BadRequestException("Student is already on a team for this case");
    }
    await this.db.insert(classChallengeTeamMembers).values({
      teamId: team.id,
      learnerId: data.learnerId,
      assignedAt: Date.now(),
    });
    return { ok: true, teamId: team.id, learnerId: data.learnerId };
  }

  async moderateContribution(
    user: SessionUser,
    classId: string,
    challengeId: string,
    contributionId: string,
    body: unknown,
  ) {
    await this.requireOwnedClass(user, classId);
    const challenge = await this.requireChallengeInClass(classId, challengeId);
    const data = parseBody(moderateContributionBodySchema, body);
    const [row] = await this.db
      .select()
      .from(classChallengeContributions)
      .where(
        and(
          eq(classChallengeContributions.id, contributionId),
          eq(classChallengeContributions.challengeId, challenge.id),
        ),
      );
    if (!row) throw new NotFoundException("Contribution not found");
    await this.db
      .update(classChallengeContributions)
      .set({ status: data.status })
      .where(eq(classChallengeContributions.id, row.id));
    return this.getTeacherChallenge(user, classId, challengeId);
  }

  async listStudentChallenges(user: SessionUser): Promise<StudentChallengeListItem[]> {
    if (!user) throw new UnauthorizedException("Sign in required");
    const memberships = await this.db
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.learnerId, user.id), isNull(classMembers.archivedAt)));
    const items: StudentChallengeListItem[] = [];
    for (const membership of memberships) {
      const [klass] = await this.db.select().from(classes).where(eq(classes.id, membership.classId));
      if (!klass || klass.archivedAt || !klass.challengesEnabled) continue;
      const rows = await this.db
        .select()
        .from(classChallenges)
        .where(
          and(
            eq(classChallenges.classId, klass.id),
            eq(classChallenges.enabled, true),
            isNull(classChallenges.archivedAt),
          ),
        )
        .orderBy(asc(classChallenges.createdAt));
      for (const row of rows) {
        const [participant] = await this.db
          .select()
          .from(classChallengeParticipants)
          .where(
            and(
              eq(classChallengeParticipants.challengeId, row.id),
              eq(classChallengeParticipants.learnerId, user.id),
            ),
          );
        items.push({
          id: row.id,
          classId: klass.id,
          className: klass.name,
          kind: row.kind as ChallengeKind,
          title: row.title,
          participation: participant
            ? participant.withdrawnAt
              ? "withdrawn"
              : "opted_in"
            : "available",
          displayMode: (participant?.displayMode as ChallengeDisplayMode) ?? "alias",
          alias: participant?.alias ?? null,
        });
      }
    }
    return items;
  }

  async getStudentChallenge(user: SessionUser, challengeId: string): Promise<StudentChallengeView> {
    const { challenge, klass } = await this.requireVisibleStudentChallenge(user, challengeId);
    return this.toStudentView(user.id, challenge, klass);
  }

  async optIn(user: SessionUser, challengeId: string, body: unknown) {
    const data = parseBody(optInChallengeBodySchema, body);
    const { challenge } = await this.requireVisibleStudentChallenge(user, challengeId);
    await this.ensureLearner(user);
    const alias = challengeAliasFor(challenge.id, user.id);
    const displayMode = data.displayMode ?? "alias";
    const [existing] = await this.db
      .select()
      .from(classChallengeParticipants)
      .where(
        and(
          eq(classChallengeParticipants.challengeId, challenge.id),
          eq(classChallengeParticipants.learnerId, user.id),
        ),
      );
    if (existing) {
      await this.db
        .update(classChallengeParticipants)
        .set({
          withdrawnAt: null,
          displayMode,
          alias: existing.alias || alias,
          optedInAt: existing.withdrawnAt ? Date.now() : existing.optedInAt,
        })
        .where(
          and(
            eq(classChallengeParticipants.challengeId, challenge.id),
            eq(classChallengeParticipants.learnerId, user.id),
          ),
        );
    } else {
      await this.db.insert(classChallengeParticipants).values({
        challengeId: challenge.id,
        learnerId: user.id,
        alias,
        displayMode,
        optedInAt: Date.now(),
        withdrawnAt: null,
      });
    }
    return this.getStudentChallenge(user, challengeId);
  }

  async withdraw(user: SessionUser, challengeId: string) {
    const { challenge } = await this.requireVisibleStudentChallenge(user, challengeId);
    const participant = await this.activeParticipant(challenge.id, user.id);
    if (!participant) throw new BadRequestException("You are not in this challenge");
    await this.db
      .update(classChallengeParticipants)
      .set({ withdrawnAt: Date.now() })
      .where(
        and(
          eq(classChallengeParticipants.challengeId, challenge.id),
          eq(classChallengeParticipants.learnerId, user.id),
        ),
      );
    return { ok: true };
  }

  async patchParticipation(user: SessionUser, challengeId: string, body: unknown) {
    const data = parseBody(patchParticipationBodySchema, body);
    const { challenge } = await this.requireVisibleStudentChallenge(user, challengeId);
    const participant = await this.activeParticipant(challenge.id, user.id);
    if (!participant) throw new BadRequestException("Opt in before choosing a display name");
    await this.db
      .update(classChallengeParticipants)
      .set({ displayMode: data.displayMode })
      .where(
        and(
          eq(classChallengeParticipants.challengeId, challenge.id),
          eq(classChallengeParticipants.learnerId, user.id),
        ),
      );
    return this.getStudentChallenge(user, challengeId);
  }

  async contribute(user: SessionUser, challengeId: string, body: unknown) {
    const data = parseBody(contributeChallengeBodySchema, body);
    const { challenge } = await this.requireVisibleStudentChallenge(user, challengeId);
    const participant = await this.activeParticipant(challenge.id, user.id);
    if (!participant) {
      throw new ForbiddenException("Opt in to contribute. Challenges are optional.");
    }
    const evidenceKey = normalizeEvidenceKey(data.evidenceKey);
    const [existing] = await this.db
      .select()
      .from(classChallengeContributions)
      .where(
        and(
          eq(classChallengeContributions.challengeId, challenge.id),
          eq(classChallengeContributions.learnerId, user.id),
          eq(classChallengeContributions.evidenceKey, evidenceKey),
        ),
      );
    if (existing) {
      return this.getStudentChallenge(user, challengeId);
    }
    let teamId: string | null = null;
    if (challenge.kind === "team_case") {
      const teams = await this.loadTeams(challenge.id);
      const mine = teams.find((team) => team.memberIds.includes(user.id));
      if (!mine) {
        throw new BadRequestException("Ask your teacher to assign you to a team case first");
      }
      teamId = mine.id;
    }
    await this.db.insert(classChallengeContributions).values({
      id: randomUUID(),
      challengeId: challenge.id,
      learnerId: user.id,
      teamId,
      evidenceKey,
      title: data.title,
      note: data.note ?? null,
      status: challenge.kind === "team_case" ? "pending" : "accepted",
      createdAt: Date.now(),
    });
    return this.getStudentChallenge(user, challengeId);
  }

  private async toStudentView(
    viewerId: string,
    challenge: typeof classChallenges.$inferSelect,
    klass: typeof classes.$inferSelect,
  ): Promise<StudentChallengeView> {
    const members = await this.db
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, klass.id), isNull(classMembers.archivedAt)));
    const participantRows = await this.db
      .select()
      .from(classChallengeParticipants)
      .where(eq(classChallengeParticipants.challengeId, challenge.id));
    const participants: ChallengeParticipantRecord[] = [];
    for (const row of participantRows) {
      const [learner] = await this.db.select().from(learners).where(eq(learners.id, row.learnerId));
      participants.push({
        learnerId: row.learnerId,
        alias: row.alias,
        displayMode: row.displayMode as ChallengeDisplayMode,
        displayName: learner?.displayName ?? row.learnerId,
        optedInAt: row.optedInAt,
        withdrawnAt: row.withdrawnAt,
      });
    }
    return buildStudentChallengeView({
      challenge: {
        id: challenge.id,
        classId: klass.id,
        className: klass.name,
        kind: challenge.kind as ChallengeKind,
        title: challenge.title,
        prompt: challenge.prompt,
        goalCount: challenge.goalCount,
        enabled: Boolean(challenge.enabled),
        classChallengesEnabled: Boolean(klass.challengesEnabled),
      },
      viewerId,
      classMemberIds: members.map((row) => row.learnerId),
      participants,
      contributions: await this.loadContributionRecords(challenge.id),
      teams: await this.loadTeams(challenge.id),
    });
  }

  private async loadContributionRecords(challengeId: string): Promise<ChallengeContributionRecord[]> {
    const rows = await this.db
      .select()
      .from(classChallengeContributions)
      .where(eq(classChallengeContributions.challengeId, challengeId))
      .orderBy(asc(classChallengeContributions.createdAt));
    return rows.map((row) => ({
      id: row.id,
      learnerId: row.learnerId,
      teamId: row.teamId,
      evidenceKey: row.evidenceKey,
      title: row.title,
      note: row.note,
      status: row.status as ContributionStatus,
      createdAt: row.createdAt,
    }));
  }

  private async loadTeams(challengeId: string) {
    const teams = await this.db
      .select()
      .from(classChallengeTeams)
      .where(eq(classChallengeTeams.challengeId, challengeId))
      .orderBy(asc(classChallengeTeams.createdAt));
    const result = [];
    for (const team of teams) {
      const members = await this.db
        .select()
        .from(classChallengeTeamMembers)
        .where(eq(classChallengeTeamMembers.teamId, team.id));
      result.push({
        id: team.id,
        name: team.name,
        memberIds: members.map((row) => row.learnerId),
      });
    }
    return result;
  }

  private async requireVisibleStudentChallenge(user: SessionUser, challengeId: string) {
    if (!user) throw new UnauthorizedException("Sign in required");
    const [challenge] = await this.db
      .select()
      .from(classChallenges)
      .where(eq(classChallenges.id, challengeId));
    if (!challenge || challenge.archivedAt || !challenge.enabled) {
      throw new NotFoundException("Challenge not found");
    }
    const [klass] = await this.db.select().from(classes).where(eq(classes.id, challenge.classId));
    if (!klass || klass.archivedAt || !klass.challengesEnabled) {
      throw new NotFoundException("Challenge not found");
    }
    await this.requireClassMember(klass.id, user.id);
    return { challenge, klass };
  }

  private async requireClassMember(classId: string, learnerId: string) {
    const [membership] = await this.db
      .select()
      .from(classMembers)
      .where(
        and(
          eq(classMembers.classId, classId),
          eq(classMembers.learnerId, learnerId),
          isNull(classMembers.archivedAt),
        ),
      );
    if (!membership) throw new ForbiddenException("Join this class to take part");
    return membership;
  }

  private async activeParticipant(challengeId: string, learnerId: string) {
    const [row] = await this.db
      .select()
      .from(classChallengeParticipants)
      .where(
        and(
          eq(classChallengeParticipants.challengeId, challengeId),
          eq(classChallengeParticipants.learnerId, learnerId),
          isNull(classChallengeParticipants.withdrawnAt),
        ),
      );
    return row ?? null;
  }

  private async requireChallengeInClass(classId: string, challengeId: string) {
    const [row] = await this.db
      .select()
      .from(classChallenges)
      .where(and(eq(classChallenges.id, challengeId), eq(classChallenges.classId, classId)));
    if (!row || row.archivedAt) throw new NotFoundException("Challenge not found");
    return row;
  }

  private async requireOwnedClass(user: SessionUser, classId: string) {
    if (user.role !== "teacher" && user.role !== "admin") {
      throw new ForbiddenException("Teacher access required");
    }
    const [row] = await this.db.select().from(classes).where(eq(classes.id, classId));
    if (!row || row.archivedAt) throw new NotFoundException("Class not found");
    if (row.teacherId !== user.id && user.role !== "admin") {
      throw new ForbiddenException("Not your class");
    }
    return row;
  }

  private async ensureLearner(user: SessionUser) {
    const [existing] = await this.db.select().from(learners).where(eq(learners.id, user.id));
    if (existing) return;
    await this.db.insert(learners).values({
      id: user.id,
      userId: user.id,
      displayName: user.displayName,
      avatarId: "compass",
      streak: 0,
      hearts: 5,
      heartsUpdatedAt: Date.now(),
      xp: 0,
    });
  }
}
