import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createAssignmentBodySchema,
  createClassBodySchema,
  csvSafeCell,
  joinClassBodySchema,
  toCsv,
  type SessionUser,
  type ClassReport,
  type ClassSummary,
  type StudentAssignment,
} from "@jose/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  assignments,
  attempts,
  classMembers,
  classes,
  inviteAttempts,
  learners,
  learnerProgress,
  levels,
  moduleRevisions,
  modules,
} from "../db/schema";

const INVITE_WINDOW_MS = 15 * 60 * 1000;
const INVITE_MAX_FAILURES = 8;

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

function hashInvite(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function mintInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

@Injectable()
export class ClassroomService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async listClasses(user: SessionUser): Promise<ClassSummary[]> {
    this.requireTeacher(user);
    const rows = await this.db
      .select()
      .from(classes)
      .where(and(eq(classes.teacherId, user.id), isNull(classes.archivedAt)))
      .orderBy(asc(classes.createdAt));
    const result: ClassSummary[] = [];
    for (const row of rows) {
      result.push(await this.toSummary(row, true));
    }
    return result;
  }

  async createClass(user: SessionUser, body: unknown) {
    this.requireTeacher(user);
    const data = parseBody(createClassBodySchema, body);
    const inviteCode = mintInviteCode();
    const id = randomUUID();
    const t = Date.now();
    await this.db.insert(classes).values({
      id,
      name: data.name,
      teacherId: user.id,
      inviteCodeHash: hashInvite(inviteCode),
      inviteCodeHint: inviteCode.slice(-4),
      inviteFailures: 0,
      inviteLockedUntil: null,
      archivedAt: null,
      createdAt: t,
    });
    const summary = await this.toSummary(
      (
        await this.db.select().from(classes).where(eq(classes.id, id))
      )[0]!,
      true,
    );
    return { ...summary, inviteCode };
  }

  async rotateInvite(user: SessionUser, classId: string) {
    const row = await this.requireOwnedClass(user, classId);
    const inviteCode = mintInviteCode();
    await this.db
      .update(classes)
      .set({
        inviteCodeHash: hashInvite(inviteCode),
        inviteCodeHint: inviteCode.slice(-4),
        inviteFailures: 0,
        inviteLockedUntil: null,
      })
      .where(eq(classes.id, row.id));
    return { inviteCode };
  }

  async archiveClass(user: SessionUser, classId: string) {
    await this.requireOwnedClass(user, classId);
    await this.db
      .update(classes)
      .set({ archivedAt: Date.now() })
      .where(eq(classes.id, classId));
    return { ok: true };
  }

  async joinClass(user: SessionUser, body: unknown) {
    if (!user) throw new UnauthorizedException("Sign in required");
    const data = parseBody(joinClassBodySchema, body);
    const codeHash = hashInvite(data.inviteCode);
    await this.recordInviteAttempt(user.id, codeHash, false);

    const recent = await this.db
      .select()
      .from(inviteAttempts)
      .where(eq(inviteAttempts.actorId, user.id));
    const recentFails = recent.filter(
      (row) => !row.success && row.createdAt >= Date.now() - INVITE_WINDOW_MS,
    ).length;
    if (recentFails > INVITE_MAX_FAILURES) {
      throw new ForbiddenException("Too many invite attempts. Try again later.");
    }

    const [klass] = await this.db
      .select()
      .from(classes)
      .where(and(eq(classes.inviteCodeHash, codeHash), isNull(classes.archivedAt)));
    if (!klass) {
      throw new NotFoundException("Invite code not found");
    }
    if (klass.inviteLockedUntil && klass.inviteLockedUntil > Date.now()) {
      throw new ForbiddenException("Invite code temporarily locked");
    }
    if (klass.inviteCodeHash !== codeHash) {
      const failures = klass.inviteFailures + 1;
      await this.db
        .update(classes)
        .set({
          inviteFailures: failures,
          inviteLockedUntil:
            failures >= INVITE_MAX_FAILURES ? Date.now() + INVITE_WINDOW_MS : klass.inviteLockedUntil,
        })
        .where(eq(classes.id, klass.id));
      throw new NotFoundException("Invite code not found");
    }

    await this.ensureLearner(user);
    const [existing] = await this.db
      .select()
      .from(classMembers)
      .where(
        and(eq(classMembers.classId, klass.id), eq(classMembers.learnerId, user.id)),
      );
    if (existing?.archivedAt) {
      await this.db
        .update(classMembers)
        .set({ archivedAt: null, joinedAt: Date.now() })
        .where(
          and(eq(classMembers.classId, klass.id), eq(classMembers.learnerId, user.id)),
        );
    } else if (!existing) {
      await this.db.insert(classMembers).values({
        classId: klass.id,
        learnerId: user.id,
        joinedAt: Date.now(),
        archivedAt: null,
      });
    }
    await this.db
      .update(classes)
      .set({ inviteFailures: 0, inviteLockedUntil: null })
      .where(eq(classes.id, klass.id));
    await this.recordInviteAttempt(user.id, codeHash, true);
    return { ok: true, classId: klass.id, name: klass.name };
  }

  async createAssignment(user: SessionUser, classId: string, body: unknown) {
    const klass = await this.requireOwnedClass(user, classId);
    const data = parseBody(createAssignmentBodySchema, body);
    const [mod] = await this.db.select().from(modules).where(eq(modules.id, data.moduleId));
    if (!mod || !mod.published || !mod.publishedRevisionId) {
      throw new BadRequestException("Assign a published module revision");
    }
    if (mod.archivedAt || mod.trashedAt) {
      throw new BadRequestException("Module is archived");
    }
    const revisionId = data.contentRevisionId ?? mod.publishedRevisionId;
    const [revision] = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, revisionId));
    if (!revision || revision.moduleId !== mod.id) {
      throw new BadRequestException("Unknown content revision");
    }
    const id = randomUUID();
    await this.db.insert(assignments).values({
      id,
      classId: klass.id,
      moduleId: mod.id,
      contentRevisionId: revisionId,
      dueAt: data.dueAt ?? null,
      assignedAt: Date.now(),
      archivedAt: null,
    });
    return this.getAssignment(user, id);
  }

  async getAssignment(user: SessionUser, assignmentId: string) {
    const row = await this.requireAssignment(assignmentId);
    await this.requireOwnedClass(user, row.classId);
    const [mod] = await this.db.select().from(modules).where(eq(modules.id, row.moduleId));
    const [revision] = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, row.contentRevisionId));
    return {
      id: row.id,
      classId: row.classId,
      moduleId: row.moduleId,
      moduleTitle: mod?.title ?? row.moduleId,
      contentRevisionId: row.contentRevisionId,
      revisionNumber: revision?.revisionNumber ?? 0,
      dueAt: row.dueAt,
      assignedAt: row.assignedAt,
      archivedAt: row.archivedAt,
    };
  }

  async listStudentAssignments(user: SessionUser): Promise<StudentAssignment[]> {
    const memberships = await this.db
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.learnerId, user.id), isNull(classMembers.archivedAt)));
    const result: StudentAssignment[] = [];
    for (const membership of memberships) {
      const rows = await this.db
        .select()
        .from(assignments)
        .where(and(eq(assignments.classId, membership.classId), isNull(assignments.archivedAt)));
      for (const row of rows) {
        const detail = await this.assignmentProgress(user.id, row);
        result.push(detail);
      }
    }
    return result;
  }

  async classReport(user: SessionUser, classId: string, assignmentId: string): Promise<ClassReport> {
    await this.requireOwnedClass(user, classId);
    const assignment = await this.requireAssignment(assignmentId);
    if (assignment.classId !== classId) {
      throw new ForbiddenException("Assignment is not in this class");
    }
    const [mod] = await this.db.select().from(modules).where(eq(modules.id, assignment.moduleId));
    const members = await this.db
      .select()
      .from(classMembers)
      .where(eq(classMembers.classId, classId));
    const memberRows = [];
    for (const member of members) {
      const progress = await this.memberProgress(member.learnerId, assignment, member.archivedAt);
      memberRows.push(progress);
    }
    const counts = {
      notStarted: memberRows.filter((m) => m.status === "not_started").length,
      inProgress: memberRows.filter((m) => m.status === "in_progress").length,
      completed: memberRows.filter((m) => m.status === "completed").length,
    };
    return {
      classId,
      assignmentId,
      moduleId: assignment.moduleId,
      moduleTitle: mod?.title ?? assignment.moduleId,
      contentRevisionId: assignment.contentRevisionId,
      members: memberRows,
      counts,
      misconceptions: await this.misconceptions(assignment),
    };
  }

  async exportClassReportCsv(user: SessionUser, classId: string, assignmentId: string) {
    const report = await this.classReport(user, classId, assignmentId);
    const rows: Array<Array<string | number | null>> = [
      [
        "learnerId",
        "displayName",
        "status",
        "completedCount",
        "totalCount",
        "masteryPercent",
        "latestAttemptAt",
        "bestScore",
        "bestMaxScore",
        "archivedAt",
      ],
    ];
    for (const member of report.members) {
      rows.push([
        member.learnerId,
        member.displayName,
        member.status,
        member.completedCount,
        member.totalCount,
        member.masteryPercent,
        member.latestAttemptAt,
        member.bestScore,
        member.bestMaxScore,
        member.archivedAt,
      ]);
    }
    return {
      filename: `class-${classId}-assignment-${assignmentId}.csv`,
      csv: toCsv(rows),
      // expose helper for tests
      safe: csvSafeCell,
    };
  }

  private async assignmentProgress(
    learnerId: string,
    row: typeof assignments.$inferSelect,
  ): Promise<StudentAssignment> {
    const [mod] = await this.db.select().from(modules).where(eq(modules.id, row.moduleId));
    const [revision] = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, row.contentRevisionId));
    const levelIds = await this.revisionLevelIds(row.contentRevisionId);
    const completed = await this.completedSet(learnerId);
    const completedCount = levelIds.filter((id) => completed.has(id)).length;
    const status =
      completedCount <= 0
        ? "not_started"
        : completedCount >= levelIds.length
          ? "completed"
          : "in_progress";
    const nextLevelId = levelIds.find((id) => !completed.has(id)) ?? null;
    return {
      id: row.id,
      classId: row.classId,
      moduleId: row.moduleId,
      moduleTitle: mod?.title ?? row.moduleId,
      contentRevisionId: row.contentRevisionId,
      revisionNumber: revision?.revisionNumber ?? 0,
      dueAt: row.dueAt,
      assignedAt: row.assignedAt,
      archivedAt: row.archivedAt,
      status,
      nextLevelId,
      completedCount,
      totalCount: levelIds.length,
    };
  }

  private async memberProgress(
    learnerId: string,
    assignment: typeof assignments.$inferSelect,
    archivedAt: number | null,
  ) {
    const [learner] = await this.db.select().from(learners).where(eq(learners.id, learnerId));
    const levelIds = await this.revisionLevelIds(assignment.contentRevisionId);
    const completed = await this.completedSet(learnerId);
    const completedCount = levelIds.filter((id) => completed.has(id)).length;
    const status =
      completedCount <= 0
        ? "not_started"
        : completedCount >= levelIds.length
          ? "completed"
          : "in_progress";
    const attemptRows = await this.db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.learnerId, learnerId),
          eq(attempts.publishedRevisionId, assignment.contentRevisionId),
        ),
      );
    let bestScore: number | null = null;
    let bestMaxScore: number | null = null;
    let latestAttemptAt: number | null = null;
    for (const attempt of attemptRows) {
      if (latestAttemptAt === null || attempt.createdAt > latestAttemptAt) {
        latestAttemptAt = attempt.createdAt;
      }
      if (bestScore === null || attempt.score > bestScore) {
        bestScore = attempt.score;
        bestMaxScore = attempt.maxScore;
      }
    }
    const masteryPercent =
      bestScore !== null && bestMaxScore && bestMaxScore > 0
        ? Math.round((bestScore / bestMaxScore) * 100)
        : null;
    return {
      learnerId,
      displayName: learner?.displayName ?? learnerId,
      status: status as "not_started" | "in_progress" | "completed",
      completedCount,
      totalCount: levelIds.length,
      masteryPercent,
      latestAttemptAt,
      bestScore,
      bestMaxScore,
      archivedAt,
    };
  }

  private async misconceptions(assignment: typeof assignments.$inferSelect) {
    const rows = await this.db
      .select()
      .from(attempts)
      .where(eq(attempts.publishedRevisionId, assignment.contentRevisionId));
    const counts = new Map<string, { levelId: string; label: string; count: number }>();
    for (const row of rows) {
      if (!row.payload) continue;
      try {
        const payload = JSON.parse(row.payload) as {
          misses?: Array<{ levelId?: string; label?: string }>;
        };
        for (const miss of payload.misses ?? []) {
          const label = miss.label?.trim();
          if (!label) continue;
          const levelId = miss.levelId ?? row.levelId;
          const key = `${levelId}::${label}`;
          const current = counts.get(key) ?? { levelId, label, count: 0 };
          current.count += 1;
          counts.set(key, current);
        }
      } catch {
        // ignore malformed payloads
      }
    }
    const result = [];
    for (const value of counts.values()) {
      const [level] = await this.db.select().from(levels).where(eq(levels.id, value.levelId));
      result.push({
        levelId: value.levelId,
        levelTitle: level?.title ?? value.levelId,
        label: value.label,
        count: value.count,
      });
    }
    return result.sort((a, b) => b.count - a.count).slice(0, 20);
  }

  private async revisionLevelIds(revisionId: string): Promise<string[]> {
    const [revision] = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, revisionId));
    if (!revision) return [];
    const snapshot = JSON.parse(revision.snapshotJson) as {
      sections: Array<{ levels: Array<{ id: string }> }>;
    };
    return snapshot.sections.flatMap((section) => section.levels.map((level) => level.id));
  }

  private async completedSet(learnerId: string) {
    const rows = await this.db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, learnerId));
    return new Set(rows.map((row) => row.levelId));
  }

  private async toSummary(
    row: typeof classes.$inferSelect,
    includeCode: boolean,
  ): Promise<ClassSummary> {
    const members = await this.db
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, row.id), isNull(classMembers.archivedAt)));
    return {
      id: row.id,
      name: row.name,
      inviteCode: includeCode ? null : null,
      memberCount: members.length,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
    };
  }

  private async requireOwnedClass(user: SessionUser, classId: string) {
    this.requireTeacher(user);
    const [row] = await this.db.select().from(classes).where(eq(classes.id, classId));
    if (!row || row.archivedAt) throw new NotFoundException("Class not found");
    if (row.teacherId !== user.id && user.role !== "admin") {
      throw new ForbiddenException("Not your class");
    }
    return row;
  }

  private async requireAssignment(assignmentId: string) {
    const [row] = await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    if (!row) throw new NotFoundException("Assignment not found");
    return row;
  }

  private requireTeacher(user: SessionUser) {
    if (user.role !== "teacher" && user.role !== "admin") {
      throw new ForbiddenException("Teacher access required");
    }
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

  private async recordInviteAttempt(actorId: string, inviteCodeHash: string, success: boolean) {
    await this.db.insert(inviteAttempts).values({
      id: randomUUID(),
      actorId,
      inviteCodeHash,
      success,
      createdAt: Date.now(),
    });
  }
}
