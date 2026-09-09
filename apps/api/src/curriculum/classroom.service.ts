import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";
import {
  createAssignmentBodySchema,
  createClassBodySchema,
  csvSafeCell,
  formatScore,
  gradebookQuerySchema,
  joinClassBodySchema,
  toCsv,
  type ClassRosterResponse,
  type GradebookResponse,
  type SessionUser,
  type ClassReport,
  type ClassSummary,
  type StudentAssignment,
} from "@jose/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
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
  users,
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
      challengesEnabled: false,
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
    const archivedAt = Date.now();
    await this.db.update(classes).set({ archivedAt }).where(eq(classes.id, classId));
    await this.db
      .update(assignments)
      .set({ archivedAt })
      .where(and(eq(assignments.classId, classId), isNull(assignments.archivedAt)));
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

  async listStudentClasses(user: SessionUser) {
    if (!user) throw new UnauthorizedException("Sign in required");
    const memberships = await this.db
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.learnerId, user.id), isNull(classMembers.archivedAt)));
    const result = [];
    for (const membership of memberships) {
      const [klass] = await this.db
        .select()
        .from(classes)
        .where(and(eq(classes.id, membership.classId), isNull(classes.archivedAt)));
      if (!klass) continue;
      const assignmentRows = await this.db
        .select()
        .from(assignments)
        .where(and(eq(assignments.classId, klass.id), isNull(assignments.archivedAt)));
      let assignmentCount = 0;
      for (const row of assignmentRows) {
        if (await this.isLiveAssignment(row)) assignmentCount += 1;
      }
      result.push({
        classId: klass.id,
        name: klass.name,
        joinedAt: membership.joinedAt,
        assignmentCount,
      });
    }
    return result;
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

  async listClassAssignments(
    user: SessionUser,
    classId: string,
    opts?: { includeArchived?: boolean },
  ) {
    await this.requireOwnedClass(user, classId);
    const rows = await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.classId, classId))
      .orderBy(asc(assignments.assignedAt));
    const includeArchived = opts?.includeArchived ?? false;
    const filtered = includeArchived
      ? rows
      : rows.filter((row) => row.archivedAt === null);
    const result = [];
    for (const row of filtered) {
      if (!includeArchived && !(await this.isLiveAssignment(row))) continue;
      result.push(await this.getAssignment(user, row.id));
    }
    return result;
  }

  async gradebook(
    user: SessionUser,
    classId: string,
    rawQuery?: unknown,
  ): Promise<GradebookResponse> {
    const query = gradebookQuerySchema.parse(rawQuery ?? {});
    await this.requireOwnedClass(user, classId);
    const allRows = await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.classId, classId))
      .orderBy(asc(assignments.assignedAt));
    const visible = query.includeArchived
      ? allRows
      : allRows.filter((row) => row.archivedAt === null);
    // Stable cursor pagination on assignment id order (assignedAt already sorted).
    let start = 0;
    if (query.cursor) {
      const idx = visible.findIndex((row) => row.id === query.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = visible.slice(start, start + query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      last && start + query.limit < visible.length ? last.id : null;
    if (page.length === 0) return { classId, assignments: [], nextCursor: null };

    const memberRows = await this.db
      .select()
      .from(classMembers)
      .where(eq(classMembers.classId, classId));
    const learnerIds = [...new Set(memberRows.map((m) => m.learnerId))];
    const [learnerMap, userMap, progressMap, attemptMap, revisionMap, moduleMap] =
      await Promise.all([
        this.batchLearners(learnerIds),
        this.batchUsers(learnerIds),
        this.batchProgress(learnerIds),
        this.batchAssessmentAttempts(learnerIds),
        this.batchRevisions(page.map((p) => p.contentRevisionId)),
        this.batchModules(page.map((p) => p.moduleId)),
      ]);

    const tables = [];
    for (const row of page) {
      const levelIds = await this.revisionLevelIdsCached(
        row.contentRevisionId,
        revisionMap,
      );
      const members = memberRows.map((member) =>
        this.buildGradebookRow({
          member,
          assignment: row,
          levelIds,
          learnerMap,
          userMap,
          progressMap,
          attemptMap,
          revisionMap,
        }),
      );
      // Stable member order by joinedAt then learnerId.
      members.sort((a, b) =>
        a.joinedAt < b.joinedAt
          ? -1
          : a.joinedAt > b.joinedAt
            ? 1
            : a.learnerId.localeCompare(b.learnerId),
      );
      const counts = {
        notStarted: members.filter((m) => m.status === "not_started").length,
        inProgress: members.filter((m) => m.status === "in_progress").length,
        completed: members.filter((m) => m.status === "completed").length,
      };
      tables.push({
        id: row.id,
        classId: row.classId,
        moduleId: row.moduleId,
        moduleTitle: moduleMap.get(row.moduleId) ?? row.moduleId,
        contentRevisionId: row.contentRevisionId,
        revisionNumber: revisionMap.get(row.contentRevisionId)?.revisionNumber ?? 0,
        dueAt: row.dueAt,
        assignedAt: row.assignedAt,
        archivedAt: row.archivedAt,
        members,
        counts,
      });
    }
    return { classId, assignments: tables, nextCursor };
  }

  private async buildGradebookTableForAssignment(
    row: typeof assignments.$inferSelect,
  ) {
    const memberRows = await this.db
      .select()
      .from(classMembers)
      .where(eq(classMembers.classId, row.classId));
    const learnerIds = [...new Set(memberRows.map((m) => m.learnerId))];
    const [learnerMap, userMap, progressMap, attemptMap, revisionMap, moduleMap] =
      await Promise.all([
        this.batchLearners(learnerIds),
        this.batchUsers(learnerIds),
        this.batchProgress(learnerIds),
        this.batchAssessmentAttempts(learnerIds),
        this.batchRevisions([row.contentRevisionId]),
        this.batchModules([row.moduleId]),
      ]);
    const levelIds = await this.revisionLevelIdsCached(row.contentRevisionId, revisionMap);
    const members = memberRows.map((member) =>
      this.buildGradebookRow({
        member,
        assignment: row,
        levelIds,
        learnerMap,
        userMap,
        progressMap,
        attemptMap,
        revisionMap,
      }),
    );
    members.sort((a, b) =>
      a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : a.learnerId.localeCompare(b.learnerId),
    );
    const counts = {
      notStarted: members.filter((m) => m.status === "not_started").length,
      inProgress: members.filter((m) => m.status === "in_progress").length,
      completed: members.filter((m) => m.status === "completed").length,
    };
    return {
      id: row.id,
      classId: row.classId,
      moduleId: row.moduleId,
      moduleTitle: moduleMap.get(row.moduleId) ?? row.moduleId,
      contentRevisionId: row.contentRevisionId,
      revisionNumber: revisionMap.get(row.contentRevisionId)?.revisionNumber ?? 0,
      dueAt: row.dueAt,
      assignedAt: row.assignedAt,
      archivedAt: row.archivedAt,
      members,
      counts,
    };
  }

  async classRoster(
    user: SessionUser,
    classId: string,
    rawQuery?: unknown,
  ): Promise<ClassRosterResponse> {
    const query = gradebookQuerySchema.parse(rawQuery ?? {});
    await this.requireOwnedClass(user, classId);
    const memberRows = await this.db
      .select()
      .from(classMembers)
      .where(eq(classMembers.classId, classId));
    const learnerIds = [...new Set(memberRows.map((m) => m.learnerId))];
    const [learnerMap, userMap] = await Promise.all([
      this.batchLearners(learnerIds),
      this.batchUsers(learnerIds),
    ]);
    const sorted = [...memberRows].sort((a, b) =>
      a.joinedAt === b.joinedAt
        ? a.learnerId.localeCompare(b.learnerId)
        : a.joinedAt - b.joinedAt,
    );
    let start = 0;
    if (query.cursor) {
      const idx = sorted.findIndex((m) => m.learnerId === query.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = sorted.slice(start, start + query.limit);
    const members = page.map((member) => {
      const learner = learnerMap.get(member.learnerId);
      const account = userMap.get(member.learnerId);
      const membership =
        member.archivedAt !== null && member.archivedAt !== undefined
          ? ("archived" as const)
          : ("active" as const);
      return {
        learnerId: member.learnerId,
        displayName: learner?.displayName ?? member.learnerId,
        admissionEmail: account?.admissionEmail ?? "",
        joinedAt: new Date(member.joinedAt).toISOString(),
        membership,
        archivedAt:
          member.archivedAt === null || member.archivedAt === undefined
            ? null
            : new Date(member.archivedAt).toISOString(),
      };
    });
    const last = page[page.length - 1];
    const nextCursor =
      last && start + query.limit < sorted.length ? last.learnerId : null;
    return { classId, members, nextCursor };
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
      const [klass] = await this.db
        .select()
        .from(classes)
        .where(and(eq(classes.id, membership.classId), isNull(classes.archivedAt)));
      if (!klass) continue;
      const rows = await this.db
        .select()
        .from(assignments)
        .where(and(eq(assignments.classId, klass.id), isNull(assignments.archivedAt)));
      for (const row of rows) {
        if (!(await this.isLiveAssignment(row))) continue;
        result.push(await this.assignmentProgress(user.id, row));
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

  async exportClassReportCsv(
    user: SessionUser,
    classId: string,
    assignmentId: string,
    rawQuery?: unknown,
  ) {
    const maxRowsSchema = z.object({
      maxRows: z.coerce.number().int().min(1).max(5000).default(2000),
    });
    const parsed = maxRowsSchema.safeParse(rawQuery ?? {});
    const maxRows = parsed.success ? parsed.data.maxRows : 2000;
    await this.requireOwnedClass(user, classId);
    const assignment = await this.requireAssignment(assignmentId);
    if (assignment.classId !== classId) {
      throw new NotFoundException("Assignment not found");
    }
    const table = await this.buildGradebookTableForAssignment(assignment);
    if (table.members.length > maxRows) {
      throw new BadRequestException(
        `Export exceeds ${maxRows} rows; narrow the class roster first`,
      );
    }
    const rows: Array<Array<string | number | null>> = [
      [
        "assignmentId",
        "contentRevisionId",
        "revisionNumber",
        "moduleTitle",
        "learnerId",
        "displayName",
        "admissionEmail",
        "membership",
        "status",
        "progress",
        "completedCount",
        "totalCount",
        "bestScore",
        "bestNumerator",
        "bestDenominator",
        "latestScore",
        "latestNumerator",
        "latestDenominator",
        "latestAttemptAt",
        "joinedAt",
        "assignmentState",
      ],
    ];
    for (const member of table.members) {
      rows.push([
        table.id,
        table.contentRevisionId,
        table.revisionNumber,
        table.moduleTitle,
        member.learnerId,
        member.displayName,
        member.admissionEmail,
        member.membership,
        member.status,
        member.progress,
        member.completedCount,
        member.totalCount,
        member.bestScore,
        member.bestNumerator,
        member.bestDenominator,
        member.latestScore,
        member.latestNumerator,
        member.latestDenominator,
        member.latestAttemptAt,
        member.joinedAt,
        member.assignmentState,
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
    const completed = await this.completedSetForRevision(learnerId, row.contentRevisionId);
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
    const completed = await this.completedSetForRevision(
      learnerId,
      assignment.contentRevisionId,
    );
    const completedCount = levelIds.filter((id) => completed.has(id)).length;
    const status =
      completedCount <= 0
        ? "not_started"
        : completedCount >= levelIds.length
          ? "completed"
          : "in_progress";
    // Assessment grades only: finished assessment attempts for this revision.
    const attemptRows = await this.db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.learnerId, learnerId),
          eq(attempts.publishedRevisionId, assignment.contentRevisionId),
          eq(attempts.mode, "assessment"),
          eq(attempts.status, "finished"),
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

  private buildGradebookRow(input: {
    member: typeof classMembers.$inferSelect;
    assignment: typeof assignments.$inferSelect;
    levelIds: string[];
    learnerMap: Map<string, typeof learners.$inferSelect>;
    userMap: Map<string, typeof users.$inferSelect>;
    progressMap: Map<string, Set<string>>;
    attemptMap: Map<string, Array<typeof attempts.$inferSelect>>;
    revisionMap: Map<string, typeof moduleRevisions.$inferSelect>;
  }) {
    const { member, assignment, levelIds, learnerMap, userMap, progressMap, attemptMap } =
      input;
    const learner = learnerMap.get(member.learnerId);
    const account = userMap.get(member.learnerId);
    const progressKey = `${member.learnerId}::${assignment.contentRevisionId}`;
    const completed = progressMap.get(progressKey) ?? new Set<string>();
    const completedCount = levelIds.filter((id) => completed.has(id)).length;
    const status =
      completedCount <= 0
        ? ("not_started" as const)
        : completedCount >= levelIds.length
          ? ("completed" as const)
          : ("in_progress" as const);
    const key = `${member.learnerId}::${assignment.contentRevisionId}`;
    const rows = (attemptMap.get(key) ?? [])
      .filter((a) => a.mode === "assessment" && a.status === "finished")
      .sort((a, b) => a.createdAt - b.createdAt);
    let latest: typeof attempts.$inferSelect | null = null;
    let best: typeof attempts.$inferSelect | null = null;
    for (const row of rows) {
      latest = row;
      if (!best) {
        best = row;
        continue;
      }
      const prevPct = best.maxScore > 0 ? best.score / best.maxScore : -1;
      const nextPct = row.maxScore > 0 ? row.score / row.maxScore : -1;
      if (nextPct > prevPct || (nextPct === prevPct && row.createdAt > best.createdAt)) {
        best = row;
      }
    }
    const masteryPercent =
      best && best.maxScore > 0
        ? Math.round((best.score / best.maxScore) * 100)
        : null;
    const revision = input.revisionMap.get(assignment.contentRevisionId);
    return {
      learnerId: member.learnerId,
      displayName: learner?.displayName ?? member.learnerId,
      admissionEmail: account?.admissionEmail ?? "",
      membership:
        member.archivedAt === null || member.archivedAt === undefined
          ? ("active" as const)
          : ("archived" as const),
      status,
      progress: `${completedCount}/${levelIds.length}`,
      completedCount,
      totalCount: levelIds.length,
      masteryPercent,
      bestScore: formatScore(best?.score ?? null, best?.maxScore ?? null),
      bestNumerator: best?.score ?? null,
      bestDenominator: best?.maxScore ?? null,
      latestScore: formatScore(latest?.score ?? null, latest?.maxScore ?? null),
      latestNumerator: latest?.score ?? null,
      latestDenominator: latest?.maxScore ?? null,
      latestAttemptAt: latest ? new Date(latest.createdAt).toISOString() : null,
      assignedRevisionId: assignment.contentRevisionId,
      revisionNumber: revision?.revisionNumber ?? 0,
      assignmentState: assignment.archivedAt
        ? ("archived" as const)
        : ("active" as const),
      joinedAt: new Date(member.joinedAt).toISOString(),
      archivedAt:
        member.archivedAt === null || member.archivedAt === undefined
          ? null
          : new Date(member.archivedAt).toISOString(),
    };
  }

  private async batchLearners(learnerIds: string[]) {
    const map = new Map<string, typeof learners.$inferSelect>();
    if (learnerIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(learners)
      .where(inArray(learners.id, learnerIds));
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private async batchUsers(userIds: string[]) {
    const map = new Map<string, typeof users.$inferSelect>();
    if (userIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private async batchProgress(learnerIds: string[]) {
    const map = new Map<string, Set<string>>();
    if (learnerIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(learnerProgress)
      .where(inArray(learnerProgress.learnerId, learnerIds));
    for (const row of rows) {
      // Key by learner + revision so overlapping level IDs in distinct
      // revisions never leak. Rows without a revision are preserved in the
      // table but excluded from revision-scoped counts.
      if (!row.publishedRevisionId) continue;
      const key = `${row.learnerId}::${row.publishedRevisionId}`;
      const set = map.get(key) ?? new Set<string>();
      set.add(row.levelId);
      map.set(key, set);
    }
    return map;
  }

  private async batchAssessmentAttempts(learnerIds: string[]) {
    const map = new Map<string, Array<typeof attempts.$inferSelect>>();
    if (learnerIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(attempts)
      .where(
        and(
          inArray(attempts.learnerId, learnerIds),
          eq(attempts.mode, "assessment"),
          eq(attempts.status, "finished"),
        ),
      );
    for (const row of rows) {
      if (!row.publishedRevisionId) continue;
      const key = `${row.learnerId}::${row.publishedRevisionId}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }

  private async batchRevisions(revisionIds: string[]) {
    const map = new Map<string, typeof moduleRevisions.$inferSelect>();
    const unique = [...new Set(revisionIds)];
    if (unique.length === 0) return map;
    const rows = await this.db
      .select()
      .from(moduleRevisions)
      .where(inArray(moduleRevisions.id, unique));
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private async batchModules(moduleIds: string[]) {
    const map = new Map<string, string>();
    const unique = [...new Set(moduleIds)];
    if (unique.length === 0) return map;
    const rows = await this.db
      .select()
      .from(modules)
      .where(inArray(modules.id, unique));
    for (const row of rows) map.set(row.id, row.title);
    return map;
  }

  private async revisionLevelIdsCached(
    revisionId: string,
    revisionMap: Map<string, typeof moduleRevisions.$inferSelect>,
  ): Promise<string[]> {
    const cached = revisionMap.get(revisionId);
    const snapshotJson = cached?.snapshotJson;
    if (!snapshotJson) return this.revisionLevelIds(revisionId);
    try {
      const snapshot = JSON.parse(snapshotJson) as {
        sections: Array<{ levels: Array<{ id: string }> }>;
      };
      return snapshot.sections.flatMap((section) =>
        section.levels.map((level) => level.id),
      );
    } catch {
      return [];
    }
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

  private async completedSetForRevision(learnerId: string, revisionId: string) {
    const rows = await this.db
      .select()
      .from(learnerProgress)
      .where(
        and(
          eq(learnerProgress.learnerId, learnerId),
          eq(learnerProgress.publishedRevisionId, revisionId),
        ),
      );
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
      inviteCodeHint: row.inviteCodeHint,
      memberCount: members.length,
      challengesEnabled: Boolean(row.challengesEnabled),
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

  private async isLiveAssignment(row: typeof assignments.$inferSelect) {
    if (row.archivedAt) return false;
    const [klass] = await this.db.select().from(classes).where(eq(classes.id, row.classId));
    if (!klass || klass.archivedAt) return false;
    const [mod] = await this.db.select().from(modules).where(eq(modules.id, row.moduleId));
    if (!mod || mod.archivedAt || mod.trashedAt) return false;
    return true;
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
