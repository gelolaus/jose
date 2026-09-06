import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DEFAULT_AVATAR_ID,
  HEARTS_EMPTY_CODE,
  MAX_HEARTS,
  applyHeartDrip,
  attemptBodySchema,
  attemptEventSchema,
  buildMemoryAssessment,
  createLevelBodySchema,
  createModuleBodySchema,
  createSectionBodySchema,
  deriveLevelStatuses,
  emptyGameContent,
  evaluateBlankChoice,
  evaluateMemoryMatch,
  evaluateQuizChoice,
  evaluateSortCheck,
  evaluateTimelineCheck,
  finishAttemptBodySchema,
  gameContentSchema,
  gradeAssessmentFinish,
  isAvatarId,
  isLevelLocked,
  missBodySchema,
  moveBodySchema,
  nodeIconFor,
  parseGameContent,
  coerceGameContent,
  parseYoutubeVideoId,
  patchLevelBodySchema,
  patchModuleBodySchema,
  patchSectionBodySchema,
  pathPosition,
  putGameBodySchema,
  putLessonBodySchema,
  sanitizeGameForAssessment,
  shuffledCopy,
  stableStringify,
  type AssessmentSecret,
  type AttemptEvent,
  type AvatarId,
  type EvaluateEventResult,
  type FinishAttemptResult,
  type GameContent,
  type GameType,
  type Learner,
  type ModulesResponse,
  type NodeKind,
  type PathResponse,
  type PlayLevelResponse,
  type SessionUser,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { DatabaseService, type JoseDb } from "../db/database.service";
import {
  attempts,
  gameContent,
  learners,
  learnerProgress,
  lessonContent,
  levels,
  missReceipts,
  moduleCollaborators,
  modules,
  sections,
} from "../db/schema";

const FIRST_COMPLETE_XP = 10;

type MutationFaultStep =
  | "after-module-row"
  | "after-section-row"
  | "after-level-row"
  | "after-level-content"
  | "after-first-sort-swap"
  | "after-progress-insert";

type StoredEvent = AttemptEvent & {
  result: EvaluateEventResult;
  at: number;
};

function contentRevisionOf(game: GameContent): string {
  return createHash("sha256").update(stableStringify(game)).digest("hex");
}

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
export class CurriculumService {
  constructor(private readonly database: DatabaseService) {}

  private mutationFault?: (step: MutationFaultStep) => void | Promise<void>;
  private writeTail: Promise<void> = Promise.resolve();

  /** @internal testing */
  setMutationFault(hook?: (step: MutationFaultStep) => void | Promise<void>) {
    this.mutationFault = hook;
  }

  private get db() {
    return this.database.db;
  }

  private async maybeFault(step: MutationFaultStep) {
    await this.mutationFault?.(step);
  }

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(fn, fn);
    this.writeTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private runTx<T>(fn: (tx: JoseDb) => Promise<T>): Promise<T> {
    return this.enqueueWrite(() =>
      this.db.transaction((tx) => fn(tx as unknown as JoseDb)),
    );
  }

  async getLearner(learnerId: string): Promise<Learner> {
    return this.syncedLearner(learnerId);
  }

  async listPublishedModules(learnerId: string): Promise<ModulesResponse> {
    const learner = await this.getLearner(learnerId);
    const rows = await this.db
      .select()
      .from(modules)
      .where(eq(modules.published, true))
      .orderBy(desc(modules.featured), asc(modules.sortOrder));

    const orderedByModule = await this.orderedLevelIdsByModules(rows.map((row) => row.id));
    const completed = await this.completedSet(learnerId);
    const cards = rows.map((row) => {
      const ordered = orderedByModule.get(row.id) ?? [];
      const completedCount = ordered.filter((id) => completed.has(id)).length;
      return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        coverColor: row.coverColor,
        featured: row.featured,
        published: row.published,
        completedCount,
        totalCount: ordered.length,
      };
    });
    return { learner, modules: cards };
  }

  async getModulePath(moduleId: string, learnerId: string): Promise<PathResponse> {
    const mod = await this.requireModule(moduleId);
    if (!mod.published) {
      throw new NotFoundException("Module not published");
    }
    return this.buildPath(mod, learnerId);
  }

  async getFeaturedPath(learnerId: string): Promise<PathResponse> {
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(and(eq(modules.featured, true), eq(modules.published, true)))
      .limit(1);
    if (!mod) throw new NotFoundException("No featured module");
    return this.buildPath(mod, learnerId);
  }

  async getPlayLevel(levelId: string, learnerId: string): Promise<PlayLevelResponse> {
    const ctx = await this.requireStudentVisibleLevel(levelId);
    const ordered = await this.orderedLevelIds(ctx.module.id);
    const completed = await this.completedSet(learnerId);
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
    const statuses = deriveLevelStatuses(ordered, completed);
    const status = statuses[levelId] ?? "current";
    const learner = await this.syncedLearner(learnerId);
    if (ctx.level.kind === "game" && learner.hearts <= 0) {
      throw this.heartsEmpty();
    }

    const payload: PlayLevelResponse = {
      learner,
      level: {
        id: ctx.level.id,
        title: ctx.level.title,
        kind: ctx.level.kind as NodeKind,
        status,
        moduleId: ctx.module.id,
        moduleTitle: ctx.module.title,
        sectionTitle: ctx.section.title,
        gameType: (ctx.level.gameType as GameType | null) ?? null,
      },
    };

    if (ctx.level.kind === "lesson") {
      const [content] = await this.db
        .select()
        .from(lessonContent)
        .where(eq(lessonContent.levelId, levelId));
      payload.lesson = {
        markdown: content?.markdown ?? "",
        youtubeVideoId: content?.youtubeVideoId ?? null,
      };
    } else if (ctx.level.kind === "game") {
      const game = await this.loadGameContent(levelId);
      const opened = await this.openAssessmentAttempt(levelId, learnerId, game);
      payload.game = opened.play;
      payload.attempt = {
        id: opened.attemptId,
        contentRevision: opened.contentRevision,
        mode: "assessment",
        status: "open",
      };
    } else {
      payload.chest = {
        message: `You opened ${ctx.level.title}! Keep walking the path.`,
      };
    }
    return payload;
  }

  async completeLevel(levelId: string, learnerId: string) {
    const ctx = await this.requireStudentVisibleLevel(levelId);
    if (ctx.level.kind === "game") {
      throw new BadRequestException("Finish the game to complete this level");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);
    const first = await this.runTx(async (tx) => {
      const awarded = await this.markComplete(levelId, learnerId, tx);
      if (ctx.level.kind === "lesson") {
        await this.refillHearts(learnerId, tx);
      }
      return awarded;
    });
    const learner = await this.getLearner(learnerId);
    return { completed: true, firstTime: first, learner };
  }

  async recordMiss(levelId: string, learnerId: string, body: unknown = {}) {
    const data = parseBody(missBodySchema, body);
    const ctx = await this.requireStudentVisibleLevel(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Misses are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);

    await this.runTx(async (tx) => {
      await this.syncLearnerHearts(learnerId, tx);
      const inserted = await tx
        .insert(missReceipts)
        .values({
          learnerId,
          idempotencyKey: data.idempotencyKey,
          levelId,
          createdAt: Date.now(),
        })
        .onConflictDoNothing()
        .returning({ key: missReceipts.idempotencyKey });

      if (inserted.length === 0) {
        return;
      }

      const [row] = await tx.select().from(learners).where(eq(learners.id, learnerId));
      if (!row || row.hearts <= 0) {
        throw this.heartsEmpty();
      }
      const leavingFull = row.hearts >= MAX_HEARTS;
      const spent = await tx
        .update(learners)
        .set({
          hearts: sql`${learners.hearts} - 1`,
          heartsUpdatedAt: leavingFull ? Date.now() : row.heartsUpdatedAt,
        })
        .where(and(eq(learners.id, learnerId), sql`${learners.hearts} > 0`))
        .returning({ id: learners.id });
      if (spent.length === 0) {
        throw this.heartsEmpty();
      }
    });
    return { learner: await this.getLearner(learnerId) };
  }

  /**
   * Rejects legacy client-scored attempt posts. Assessment finishes must use
   * the server-issued attempt id and answer events.
   */
  async submitAttempt(levelId: string, body: unknown, learnerId: string) {
    await this.requireStudentVisibleLevel(levelId);
    void learnerId;
    if (body && typeof body === "object" && ("score" in body || "maxScore" in body)) {
      throw new BadRequestException(
        "Client scores are not accepted; finish the server-issued attempt instead",
      );
    }
    parseBody(attemptBodySchema, body ?? {});
    throw new BadRequestException(
      "Start play via GET /levels/:id, then POST /attempts/:attemptId/finish",
    );
  }

  async evaluateAttempt(
    attemptId: string,
    body: unknown,
    learnerId: string,
  ): Promise<EvaluateEventResult> {
    const event = parseBody(attemptEventSchema, body);
    const attempt = await this.requireOpenAttempt(attemptId, learnerId);
    const ctx = await this.requireStudentVisibleLevel(attempt.levelId);
    void ctx;
    const game = await this.loadGameContent(attempt.levelId);
    this.assertAttemptRevision(attempt.contentRevision, game);

    const secret = this.parseSecret(attempt.secretJson);
    const result = this.gradeEvent(game, secret, event);
    const misses = await this.runTx(async (tx) => {
      const [freshAttempt] = await tx
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.id, attemptId),
            eq(attempts.learnerId, learnerId),
            eq(attempts.status, "open"),
          ),
        )
        .limit(1);
      if (!freshAttempt) {
        throw new BadRequestException("Attempt is already finished");
      }
      const events = this.parseEvents(freshAttempt.eventsJson);
      events.push({ ...event, result, at: Date.now() });
      await tx
        .update(attempts)
        .set({ eventsJson: JSON.stringify(events) })
        .where(eq(attempts.id, attemptId));
      return events.reduce((sum, row) => sum + Math.max(0, row.result.misses), 0);
    });
    return {
      ...result,
      misses,
    };
  }

  async finishAttempt(
    attemptId: string,
    body: unknown,
    learnerId: string,
  ): Promise<FinishAttemptResult> {
    const data = parseBody(finishAttemptBodySchema, body ?? {});
    if (data.clientAttemptId) {
      const [prior] = await this.db
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.learnerId, learnerId),
            eq(attempts.clientAttemptId, data.clientAttemptId),
            eq(attempts.status, "finished"),
          ),
        )
        .limit(1);
      if (prior && prior.id !== attemptId) {
        return this.finishedAttemptResult(prior, learnerId, true);
      }
    }

    const attempt = await this.requireAttemptRow(attemptId);
    if (attempt.learnerId !== learnerId) {
      throw new ForbiddenException("This attempt belongs to another learner");
    }
    if (attempt.mode !== "assessment") {
      throw new BadRequestException("Practice attempts are not finished through assessment");
    }

    if (attempt.status === "finished") {
      if (attempt.payload && attempt.payload.includes('"abandoned":true')) {
        throw new BadRequestException("This attempt was abandoned; reload the level");
      }
      return this.finishedAttemptResult(attempt, learnerId, true);
    }

    const ctx = await this.requireStudentVisibleLevel(attempt.levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Attempts are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, attempt.levelId, learnerId);
    const learnerBefore = await this.syncedLearner(learnerId);
    if (learnerBefore.hearts <= 0) {
      throw this.heartsEmpty();
    }

    const game = await this.loadGameContent(attempt.levelId);
    this.assertAttemptRevision(attempt.contentRevision, game);

    if (data.answers.type !== game.type) {
      throw new BadRequestException("Answer type does not match this game");
    }

    const events = this.parseEvents(attempt.eventsJson);
    const priorMisses = events.reduce(
      (sum, row) => sum + Math.max(0, row.result.misses),
      0,
    );
    const secret = this.parseSecret(attempt.secretJson);

    let graded;
    try {
      graded = gradeAssessmentFinish(game, data.answers, priorMisses, secret);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Could not grade attempt",
      );
    }

    const finishedAt = Date.now();
    const first = await this.runTx(async (tx) => {
      const updated = await tx
        .update(attempts)
        .set({
          status: "finished",
          score: graded.score,
          maxScore: graded.maxScore,
          stars: graded.stars,
          finishedAt,
          clientAttemptId: data.clientAttemptId ?? attempt.clientAttemptId,
          payload: JSON.stringify({
            misses: graded.misses,
            stars: graded.stars,
            events: events.length,
            answers: data.answers,
            source: "server",
          }),
        })
        .where(and(eq(attempts.id, attemptId), eq(attempts.status, "open")))
        .returning({ id: attempts.id });
      if (updated.length === 0) {
        return false;
      }
      return this.markComplete(attempt.levelId, learnerId, tx);
    });

    const [fresh] = await this.db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId));
    if (!fresh || fresh.status !== "finished") {
      throw new BadRequestException("Could not finish attempt");
    }
    return this.finishedAttemptResult(fresh, learnerId, fresh.finishedAt !== finishedAt, first);
  }

  /** Teachers only see modules they own or were explicitly granted; admins see all. */
  async listTeachModules(user: SessionUser): Promise<TeachModule[]> {
    const rows = await this.db
      .select()
      .from(modules)
      .orderBy(desc(modules.featured), asc(modules.sortOrder));
    const collaboratorModuleIds =
      user.role === "admin"
        ? null
        : new Set(
            (
              await this.db
                .select({ moduleId: moduleCollaborators.moduleId })
                .from(moduleCollaborators)
                .where(eq(moduleCollaborators.userId, user.id))
            ).map((row) => row.moduleId),
          );
    const visible = rows.filter((row) => {
      if (user.role === "admin") return true;
      const isOwner = row.ownerUserId != null && row.ownerUserId === user.id;
      return isOwner || Boolean(collaboratorModuleIds?.has(row.id));
    });
    const ids = visible.map((row) => row.id);
    const orderedByModule = await this.orderedLevelIdsByModules(ids);
    const sectionCounts = await this.sectionCountsByModules(ids);
    return visible.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      coverColor: row.coverColor,
      featured: row.featured,
      published: row.published,
      sortOrder: row.sortOrder,
      sectionCount: sectionCounts.get(row.id) ?? 0,
      levelCount: (orderedByModule.get(row.id) ?? []).length,
      ownerUserId: row.ownerUserId ?? null,
    }));
  }

  async getTeachModule(moduleId: string): Promise<TeachModuleDetail> {
    const mod = await this.requireModule(moduleId);
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, moduleId))
      .orderBy(asc(sections.sortOrder));
    const levelsBySection = await this.levelsBySectionIds(sectionRows.map((s) => s.id));
    const detailSections = sectionRows.map((section) => {
      const levelRows = levelsBySection.get(section.id) ?? [];
      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        themeColor: section.themeColor,
        sortOrder: section.sortOrder,
        levels: levelRows.map((level) => ({
          id: level.id,
          title: level.title,
          kind: level.kind as NodeKind,
          gameType: (level.gameType as GameType | null) ?? null,
          sortOrder: level.sortOrder,
        })),
      };
    });
    const summary = await this.toTeachModule(mod);
    return { ...summary, sections: detailSections };
  }

  async createModule(body: unknown, user: SessionUser) {
    const data = parseBody(createModuleBodySchema, body);
    const id = randomUUID();
    const sectionId = randomUUID();
    const t = Date.now();
    const maxSort = await this.maxModuleSort();
    await this.runTx(async (tx) => {
      await tx.insert(modules).values({
        id,
        title: data.title,
        subtitle: data.subtitle,
        coverColor: data.coverColor,
        sortOrder: maxSort + 1,
        published: false,
        featured: false,
        ownerUserId: user.id,
        createdAt: t,
        updatedAt: t,
      });
      await this.maybeFault("after-module-row");
      await tx.insert(sections).values({
        id: sectionId,
        moduleId: id,
        title: "Levels",
        subtitle: "Start adding lessons and games",
        themeColor: data.coverColor,
        sortOrder: 0,
      });
      await this.maybeFault("after-section-row");
    });
    return this.getTeachModule(id);
  }

  async addModuleCollaborator(
    moduleId: string,
    userId: string,
    grantedByUserId: string,
  ) {
    await this.requireModule(moduleId);
    await this.db
      .insert(moduleCollaborators)
      .values({
        moduleId,
        userId,
        grantedByUserId,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
    return { ok: true, moduleId, userId };
  }

  /** Route guards resolve a section's module before any edit is allowed. */
  async requireSectionPublic(sectionId: string) {
    return this.requireSection(sectionId);
  }

  async moduleIdForLevel(levelId: string) {
    const ctx = await this.levelContext(levelId);
    return ctx.module.id;
  }

  async patchModule(moduleId: string, body: unknown) {
    const data = parseBody(patchModuleBodySchema, body);
    await this.requireModule(moduleId);
    if (data.published === true) {
      const problems = await this.publishProblems(moduleId);
      if (problems.length > 0) {
        throw new BadRequestException(
          `Finish these levels before publishing: ${problems.join(", ")}`,
        );
      }
    }
    await this.db
      .update(modules)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.subtitle !== undefined ? { subtitle: data.subtitle } : {}),
        ...(data.coverColor !== undefined ? { coverColor: data.coverColor } : {}),
        ...(data.published !== undefined ? { published: data.published } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(modules.id, moduleId));
    return this.getTeachModule(moduleId);
  }

  async deleteModule(moduleId: string) {
    const mod = await this.requireModule(moduleId);
    if (mod.featured) {
      throw new BadRequestException("The Life of Rizal module cannot be deleted");
    }
    await this.runTx(async (tx) => {
      await this.deleteLevelsByModule(moduleId, tx);
      await tx.delete(sections).where(eq(sections.moduleId, moduleId));
      await tx.delete(modules).where(eq(modules.id, moduleId));
    });
    return { ok: true };
  }

  async createSection(moduleId: string, body: unknown) {
    await this.requireModule(moduleId);
    const data = parseBody(createSectionBodySchema, body);
    const id = randomUUID();
    await this.runTx(async (tx) => {
      const siblings = await tx
        .select()
        .from(sections)
        .where(eq(sections.moduleId, moduleId));
      await tx.insert(sections).values({
        id,
        moduleId,
        title: data.title,
        subtitle: data.subtitle,
        themeColor: data.themeColor,
        sortOrder: siblings.length,
      });
      await this.maybeFault("after-section-row");
      await this.touchModule(moduleId, tx);
    });
    return this.getTeachModule(moduleId);
  }

  async patchSection(sectionId: string, body: unknown) {
    const section = await this.requireSection(sectionId);
    const data = parseBody(patchSectionBodySchema, body);
    await this.db
      .update(sections)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.subtitle !== undefined ? { subtitle: data.subtitle } : {}),
        ...(data.themeColor !== undefined ? { themeColor: data.themeColor } : {}),
      })
      .where(eq(sections.id, sectionId));
    await this.touchModule(section.moduleId);
    return this.getTeachModule(section.moduleId);
  }

  async deleteSection(sectionId: string) {
    const section = await this.requireSection(sectionId);
    const siblings = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, section.moduleId));
    if (siblings.length <= 1) {
      throw new BadRequestException("A module needs at least one section");
    }
    await this.runTx(async (tx) => {
      const levelRows = await tx
        .select()
        .from(levels)
        .where(eq(levels.sectionId, sectionId));
      await this.deleteLevelRows(
        levelRows.map((l) => l.id),
        tx,
      );
      await tx.delete(sections).where(eq(sections.id, sectionId));
      await this.touchModule(section.moduleId, tx);
    });
    return this.getTeachModule(section.moduleId);
  }

  async createLevel(sectionId: string, body: unknown) {
    const section = await this.requireSection(sectionId);
    const data = parseBody(createLevelBodySchema, body);
    const id = randomUUID();
    await this.runTx(async (tx) => {
      const siblings = await tx
        .select()
        .from(levels)
        .where(eq(levels.sectionId, sectionId));
      await tx.insert(levels).values({
        id,
        sectionId,
        title: data.title,
        kind: data.kind,
        gameType: data.kind === "game" ? data.gameType! : null,
        sortOrder: siblings.length,
      });
      await this.maybeFault("after-level-row");
      if (data.kind === "lesson") {
        await tx.insert(lessonContent).values({
          levelId: id,
          markdown: `## ${data.title}\n\nWrite the lesson here.`,
          youtubeVideoId: null,
        });
      } else {
        await tx.insert(gameContent).values({
          levelId: id,
          json: JSON.stringify(emptyGameContent(data.gameType!)),
        });
      }
      await this.maybeFault("after-level-content");
      await this.touchModule(section.moduleId, tx);
    });
    return this.getTeachLevel(id);
  }

  async patchLevel(levelId: string, body: unknown) {
    await this.levelContext(levelId);
    const data = parseBody(patchLevelBodySchema, body);
    if (data.title !== undefined) {
      await this.db
        .update(levels)
        .set({ title: data.title })
        .where(eq(levels.id, levelId));
    }
    return this.getTeachLevel(levelId);
  }

  async deleteLevel(levelId: string) {
    const ctx = await this.levelContext(levelId);
    const siblings = await this.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, ctx.section.id));
    if (siblings.length <= 1) {
      throw new BadRequestException("A section needs at least one level");
    }
    await this.runTx(async (tx) => {
      await this.deleteLevelRows([levelId], tx);
      await this.touchModule(ctx.module.id, tx);
    });
    return { ok: true };
  }

  async moveLevel(levelId: string, body: unknown) {
    const data = parseBody(moveBodySchema, body);
    const ctx = await this.requireAuthorizedTeacherPreview(levelId);
    await this.runTx(async (tx) => {
      const siblings = await tx
        .select()
        .from(levels)
        .where(eq(levels.sectionId, ctx.section.id))
        .orderBy(asc(levels.sortOrder));
      const index = siblings.findIndex((row) => row.id === levelId);
      const swapWith = data.direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= siblings.length) {
        return;
      }
      const a = siblings[index]!;
      const b = siblings[swapWith]!;
      await tx
        .update(levels)
        .set({ sortOrder: b.sortOrder })
        .where(eq(levels.id, a.id));
      await this.maybeFault("after-first-sort-swap");
      await tx
        .update(levels)
        .set({ sortOrder: a.sortOrder })
        .where(eq(levels.id, b.id));
      await this.touchModule(ctx.module.id, tx);
    });
    return this.getTeachModule(ctx.module.id);
  }

  async putLesson(levelId: string, body: unknown) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "lesson") {
      throw new BadRequestException("This level is not a lesson");
    }
    const data = parseBody(putLessonBodySchema, body);
    let youtubeVideoId: string | null = null;
    if (data.youtubeUrl && data.youtubeUrl.trim()) {
      youtubeVideoId = parseYoutubeVideoId(data.youtubeUrl);
      if (!youtubeVideoId) {
        throw new BadRequestException("That does not look like a YouTube URL");
      }
    }
    await this.db
      .insert(lessonContent)
      .values({
        levelId,
        markdown: data.markdown,
        youtubeVideoId,
      })
      .onConflictDoUpdate({
        target: lessonContent.levelId,
        set: { markdown: data.markdown, youtubeVideoId },
      });
    await this.touchModule(ctx.module.id);
    return this.getTeachLevel(levelId);
  }

  async putGame(levelId: string, body: unknown) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("This level is not a game");
    }
    const data = parseBody(putGameBodySchema, body);
    await this.db
      .insert(gameContent)
      .values({ levelId, json: JSON.stringify(data) })
      .onConflictDoUpdate({
        target: gameContent.levelId,
        set: { json: JSON.stringify(data) },
      });
    await this.touchModule(ctx.module.id);
    return this.getTeachLevel(levelId);
  }

  async getTeachLevel(levelId: string): Promise<TeachLevelDetail> {
    const ctx = await this.levelContext(levelId);
    let lesson: TeachLevelDetail["lesson"] = null;
    let game: TeachLevelDetail["game"] = null;
    if (ctx.level.kind === "lesson") {
      const [content] = await this.db
        .select()
        .from(lessonContent)
        .where(eq(lessonContent.levelId, levelId));
      lesson = {
        markdown: content?.markdown ?? "",
        youtubeVideoId: content?.youtubeVideoId ?? null,
      };
    }
    if (ctx.level.kind === "game") {
      const [content] = await this.db
        .select()
        .from(gameContent)
        .where(eq(gameContent.levelId, levelId));
      game = parseGameContent(JSON.parse(content?.json ?? "{}"));
    }
    return {
      id: ctx.level.id,
      title: ctx.level.title,
      kind: ctx.level.kind as NodeKind,
      gameType: (ctx.level.gameType as GameType | null) ?? null,
      sortOrder: ctx.level.sortOrder,
      moduleId: ctx.module.id,
      sectionId: ctx.section.id,
      lesson,
      game,
    };
  }

  private async buildPath(
    mod: typeof modules.$inferSelect,
    learnerId: string,
  ): Promise<PathResponse> {
    const learner = await this.getLearner(learnerId);
    const ordered = await this.orderedLevelIds(mod.id);
    const completed = await this.completedSet(learnerId);
    const statuses = deriveLevelStatuses(ordered, completed);
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, mod.id))
      .orderBy(asc(sections.sortOrder));

    const levelsBySection = await this.levelsBySectionIds(sectionRows.map((s) => s.id));
    let globalIndex = 0;
    const pathSections = sectionRows.map((section) => {
      const levelRows = levelsBySection.get(section.id) ?? [];
      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        themeColor: section.themeColor,
        nodes: levelRows.map((level) => {
          const kind = level.kind as NodeKind;
          const status = statuses[level.id] ?? "locked";
          const node = {
            id: level.id,
            title: level.title,
            kind,
            status,
            icon: nodeIconFor(kind, status),
            position: pathPosition(globalIndex),
            gameType: (level.gameType as GameType | null) ?? null,
          };
          globalIndex += 1;
          return node;
        }),
      };
    });

    if (pathSections.length === 0 || pathSections.every((s) => s.nodes.length === 0)) {
      throw new BadRequestException("This module has no levels yet");
    }

    return {
      module: {
        id: mod.id,
        title: mod.title,
        subtitle: mod.subtitle,
        coverColor: mod.coverColor,
        featured: mod.featured,
      },
      learner,
      sections: pathSections,
    };
  }

  /** One round-trip for ordered level ids across many modules (no per-section loop). */
  private async orderedLevelIdsByModules(
    moduleIds: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    for (const id of moduleIds) result.set(id, []);
    if (moduleIds.length === 0) return result;

    const rows = await this.db
      .select({
        moduleId: sections.moduleId,
        levelId: levels.id,
        sectionSort: sections.sortOrder,
        levelSort: levels.sortOrder,
      })
      .from(sections)
      .innerJoin(levels, eq(levels.sectionId, sections.id))
      .where(inArray(sections.moduleId, moduleIds));

    const byModule = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byModule.get(row.moduleId) ?? [];
      list.push(row);
      byModule.set(row.moduleId, list);
    }
    for (const moduleId of moduleIds) {
      const list = (byModule.get(moduleId) ?? []).sort((a, b) => {
        if (a.sectionSort !== b.sectionSort) return a.sectionSort - b.sectionSort;
        return a.levelSort - b.levelSort;
      });
      result.set(
        moduleId,
        list.map((row) => row.levelId),
      );
    }
    return result;
  }

  private async orderedLevelIds(moduleId: string): Promise<string[]> {
    const map = await this.orderedLevelIdsByModules([moduleId]);
    return map.get(moduleId) ?? [];
  }

  private async levelsBySectionIds(sectionIds: string[]) {
    const result = new Map<string, (typeof levels.$inferSelect)[]>();
    for (const id of sectionIds) result.set(id, []);
    if (sectionIds.length === 0) return result;
    const rows = await this.db
      .select()
      .from(levels)
      .where(inArray(levels.sectionId, sectionIds))
      .orderBy(asc(levels.sortOrder));
    for (const row of rows) {
      const list = result.get(row.sectionId) ?? [];
      list.push(row);
      result.set(row.sectionId, list);
    }
    return result;
  }

  private async sectionCountsByModules(moduleIds: string[]) {
    const result = new Map<string, number>();
    for (const id of moduleIds) result.set(id, 0);
    if (moduleIds.length === 0) return result;
    const rows = await this.db
      .select({ moduleId: sections.moduleId })
      .from(sections)
      .where(inArray(sections.moduleId, moduleIds));
    for (const row of rows) {
      result.set(row.moduleId, (result.get(row.moduleId) ?? 0) + 1);
    }
    return result;
  }

  private async completedSet(learnerId: string): Promise<Set<string>> {
    const rows = await this.db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, learnerId));
    return new Set(rows.map((row) => row.levelId));
  }

  private async ensureUnlocked(
    moduleId: string,
    levelId: string,
    learnerId: string,
  ) {
    const ordered = await this.orderedLevelIds(moduleId);
    const completed = await this.completedSet(learnerId);
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
  }

  private async markComplete(
    levelId: string,
    learnerId: string,
    executor: JoseDb = this.db,
  ): Promise<boolean> {
    const inserted = await executor
      .insert(learnerProgress)
      .values({
        learnerId,
        levelId,
        completedAt: Date.now(),
      })
      .onConflictDoNothing()
      .returning({ levelId: learnerProgress.levelId });
    if (inserted.length === 0) {
      return false;
    }
    await this.maybeFault("after-progress-insert");
    await executor
      .update(learners)
      .set({ xp: sql`${learners.xp} + ${FIRST_COMPLETE_XP}` })
      .where(eq(learners.id, learnerId));
    return true;
  }

  private async publishProblems(moduleId: string): Promise<string[]> {
    const detail = await this.getTeachModule(moduleId);
    const problems: string[] = [];
    for (const section of detail.sections) {
      if (section.levels.length === 0) {
        problems.push(`${section.title} (no levels)`);
        continue;
      }
      for (const level of section.levels) {
        if (level.kind === "chest") continue;
        if (level.kind === "lesson") {
          const [content] = await this.db
            .select()
            .from(lessonContent)
            .where(eq(lessonContent.levelId, level.id));
          if (!content?.markdown.trim()) problems.push(level.title);
        }
        if (level.kind === "game") {
          const [content] = await this.db
            .select()
            .from(gameContent)
            .where(eq(gameContent.levelId, level.id));
          const parsed = gameContentSchema.safeParse(
            coerceGameContent(JSON.parse(content?.json ?? "{}")),
          );
          if (!parsed.success) problems.push(level.title);
        }
      }
    }
    return problems;
  }

  private async toTeachModule(row: typeof modules.$inferSelect): Promise<TeachModule> {
    const ordered = await this.orderedLevelIds(row.id);
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, row.id));
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      coverColor: row.coverColor,
      featured: row.featured,
      published: row.published,
      sortOrder: row.sortOrder,
      sectionCount: sectionRows.length,
      levelCount: ordered.length,
      ownerUserId: row.ownerUserId ?? null,
    };
  }

  private async syncedLearner(learnerId: string): Promise<Learner> {
    const row = await this.requireLearner(learnerId);
    const dripped = applyHeartDrip(row.hearts, row.heartsUpdatedAt, Date.now());
    if (dripped.changed) {
      await this.db
        .update(learners)
        .set({
          hearts: dripped.hearts,
          heartsUpdatedAt: dripped.heartsUpdatedAt,
        })
        .where(eq(learners.id, learnerId));
    }
    const avatarId: AvatarId = isAvatarId(row.avatarId)
      ? row.avatarId
      : DEFAULT_AVATAR_ID;
    return {
      id: row.id,
      displayName: row.displayName,
      avatarId,
      streak: row.streak,
      hearts: dripped.hearts,
      xp: row.xp,
    };
  }

  private async refillHearts(learnerId: string, executor: JoseDb = this.db) {
    await executor
      .update(learners)
      .set({ hearts: MAX_HEARTS, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, learnerId));
  }

  private async syncLearnerHearts(learnerId: string, executor: JoseDb) {
    const [row] = await executor
      .select()
      .from(learners)
      .where(eq(learners.id, learnerId));
    if (!row) throw new NotFoundException("Learner not found");
    const dripped = applyHeartDrip(row.hearts, row.heartsUpdatedAt, Date.now());
    if (dripped.changed) {
      await executor
        .update(learners)
        .set({
          hearts: dripped.hearts,
          heartsUpdatedAt: dripped.heartsUpdatedAt,
        })
        .where(eq(learners.id, learnerId));
    }
  }

  private heartsEmpty() {
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: HEARTS_EMPTY_CODE,
        message: "You're out of hearts. Read a lesson or wait a bit.",
      },
      HttpStatus.FORBIDDEN,
    );
  }

  private async requireLearner(learnerId: string) {
    const [row] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, learnerId));
    if (!row) throw new NotFoundException("Learner not found");
    return row;
  }

  private async requireModule(moduleId: string) {
    const [row] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId));
    if (!row) throw new NotFoundException("Module not found");
    return row;
  }

  private async requireSection(sectionId: string) {
    const [row] = await this.db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId));
    if (!row) throw new NotFoundException("Section not found");
    return row;
  }

  private async levelContext(levelId: string) {
    const [level] = await this.db.select().from(levels).where(eq(levels.id, levelId));
    if (!level) throw new NotFoundException("Level not found");
    const section = await this.requireSection(level.sectionId);
    const mod = await this.requireModule(section.moduleId);
    return { level, section, module: mod };
  }

  /** Student-visible content: requires the module to be published. */
  private async requireStudentVisibleLevel(levelId: string) {
    const ctx = await this.levelContext(levelId);
    if (!ctx.module.published) {
      throw new NotFoundException("Level not found");
    }
    return ctx;
  }

  /**
   * Authorized teacher preview/edit path: unpublished drafts are allowed.
   * Role/ownership is enforced by teach route guards, not here.
   */
  private async requireAuthorizedTeacherPreview(levelId: string) {
    return this.levelContext(levelId);
  }

  private async maxModuleSort() {
    const rows = await this.db.select({ sortOrder: modules.sortOrder }).from(modules);
    return rows.reduce((max, row) => Math.max(max, row.sortOrder), -1);
  }

  private async touchModule(moduleId: string, executor: JoseDb = this.db) {
    await executor
      .update(modules)
      .set({ updatedAt: Date.now() })
      .where(eq(modules.id, moduleId));
  }

  private async deleteLevelsByModule(moduleId: string, executor: JoseDb = this.db) {
    const sectionRows = await executor
      .select()
      .from(sections)
      .where(eq(sections.moduleId, moduleId));
    const ids: string[] = [];
    for (const section of sectionRows) {
      const levelRows = await executor
        .select()
        .from(levels)
        .where(eq(levels.sectionId, section.id));
      ids.push(...levelRows.map((l) => l.id));
    }
    await this.deleteLevelRows(ids, executor);
  }

  private async deleteLevelRows(ids: string[], executor: JoseDb = this.db) {
    if (ids.length === 0) return;
    await executor.delete(missReceipts).where(inArray(missReceipts.levelId, ids));
    await executor.delete(attempts).where(inArray(attempts.levelId, ids));
    await executor
      .delete(learnerProgress)
      .where(inArray(learnerProgress.levelId, ids));
    await executor.delete(lessonContent).where(inArray(lessonContent.levelId, ids));
    await executor.delete(gameContent).where(inArray(gameContent.levelId, ids));
    await executor.delete(levels).where(inArray(levels.id, ids));
  }

  private async finishedAttemptResult(
    attempt: typeof attempts.$inferSelect,
    learnerId: string,
    deduplicated: boolean,
    firstTime?: boolean,
  ): Promise<FinishAttemptResult> {
    const learner = await this.getLearner(learnerId);
    return {
      attemptId: attempt.id,
      mode: "assessment",
      completed: true,
      firstTime: firstTime ?? false,
      score: attempt.score,
      maxScore: attempt.maxScore,
      stars: (attempt.stars === 2 || attempt.stars === 3 ? attempt.stars : 1) as 1 | 2 | 3,
      learner,
      deduplicated,
    };
  }

  private async openAssessmentAttempt(
    levelId: string,
    learnerId: string,
    game: GameContent,
  ) {
    return this.runTx(async (tx) => {
      const revision = contentRevisionOf(game);
      const [existing] = await tx
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.learnerId, learnerId),
            eq(attempts.levelId, levelId),
            eq(attempts.status, "open"),
            eq(attempts.mode, "assessment"),
            eq(attempts.contentRevision, revision),
          ),
        )
        .limit(1);

      if (existing) {
        const secret = this.parseSecret(existing.secretJson);
        const play = this.playPayloadFromSecret(game, secret);
        return { attemptId: existing.id, contentRevision: revision, play };
      }

      await tx
        .update(attempts)
        .set({
          status: "finished",
          finishedAt: Date.now(),
          payload: JSON.stringify({ abandoned: true }),
        })
        .where(
          and(
            eq(attempts.learnerId, learnerId),
            eq(attempts.levelId, levelId),
            eq(attempts.status, "open"),
          ),
        );

      const built =
        game.type === "memory"
          ? buildMemoryAssessment(game, () => randomUUID())
          : sanitizeGameForAssessment(game);
      const attemptId = randomUUID();
      await tx.insert(attempts).values({
        id: attemptId,
        learnerId,
        levelId,
        contentRevision: revision,
        mode: "assessment",
        status: "open",
        clientAttemptId: null,
        score: 0,
        maxScore: 0,
        stars: null,
        payload: null,
        secretJson: JSON.stringify(built.secret),
        eventsJson: "[]",
        createdAt: Date.now(),
        finishedAt: null,
      });
      return { attemptId, contentRevision: revision, play: built.play };
    });
  }

  private playPayloadFromSecret(game: GameContent, secret: AssessmentSecret) {
    if (game.type === "memory" && secret.memoryPairMap) {
      const byPair = new Map<number, string[]>();
      for (const [id, pairIndex] of Object.entries(secret.memoryPairMap)) {
        const list = byPair.get(pairIndex) ?? [];
        list.push(id);
        byPair.set(pairIndex, list);
      }
      const fixed: { id: string; text?: string; imageUrl?: string }[] = [];
      for (const [_pairIndex, ids] of byPair) {
        const pairIndex = Number(_pairIndex);
        const pair = game.pairs[pairIndex]!;
        const [idA, idB] = ids;
        fixed.push({
          id: idA!,
          ...(pair.a.text ? { text: pair.a.text } : {}),
          ...(pair.a.imageUrl ? { imageUrl: pair.a.imageUrl } : {}),
        });
        fixed.push({
          id: idB!,
          ...(pair.b.text ? { text: pair.b.text } : {}),
          ...(pair.b.imageUrl ? { imageUrl: pair.b.imageUrl } : {}),
        });
      }
      return {
        type: "memory" as const,
        pairCount: game.pairs.length,
        cards: shuffledCopy(fixed),
      };
    }
    return sanitizeGameForAssessment(game, secret).play;
  }

  private gradeEvent(
    game: GameContent,
    secret: AssessmentSecret,
    event: AttemptEvent,
  ): EvaluateEventResult {
    switch (event.type) {
      case "quiz_choice":
        if (game.type !== "quiz") throw new BadRequestException("Event type mismatch");
        return evaluateQuizChoice(game, event.questionIndex, event.choiceIndex);
      case "blank_choice":
        if (game.type !== "blank") throw new BadRequestException("Event type mismatch");
        return evaluateBlankChoice(game, event.itemIndex, event.word);
      case "memory_match":
        if (game.type !== "memory") throw new BadRequestException("Event type mismatch");
        if (!secret.memoryPairMap) {
          throw new BadRequestException("Memory attempt is missing pair map");
        }
        return evaluateMemoryMatch(
          secret.memoryPairMap,
          event.cardA,
          event.cardB,
          (pairIndex) => game.pairs[pairIndex]?.why,
        );
      case "timeline_check":
        if (game.type !== "timeline") throw new BadRequestException("Event type mismatch");
        return evaluateTimelineCheck(game, event.order);
      case "sort_check":
        if (game.type !== "sort") throw new BadRequestException("Event type mismatch");
        return evaluateSortCheck(game, event.placements);
    }
  }

  private async loadGameContent(levelId: string): Promise<GameContent> {
    const [content] = await this.db
      .select()
      .from(gameContent)
      .where(eq(gameContent.levelId, levelId));
    return parseGameContent(JSON.parse(content?.json ?? "{}"));
  }

  private assertAttemptRevision(revision: string, game: GameContent) {
    const current = contentRevisionOf(game);
    if (revision !== current) {
      throw new ConflictRevision();
    }
  }

  private async requireOpenAttempt(attemptId: string, learnerId: string) {
    const attempt = await this.requireAttemptRow(attemptId);
    if (attempt.learnerId !== learnerId) {
      throw new ForbiddenException("This attempt belongs to another learner");
    }
    if (attempt.status !== "open") {
      throw new BadRequestException("Attempt is already finished");
    }
    return attempt;
  }

  private async requireAttemptRow(attemptId: string) {
    const [row] = await this.db.select().from(attempts).where(eq(attempts.id, attemptId));
    if (!row) throw new NotFoundException("Attempt not found");
    return row;
  }

  private parseSecret(raw: string | null): AssessmentSecret {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as AssessmentSecret;
    } catch {
      return {};
    }
  }

  private parseEvents(raw: string | null): StoredEvent[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredEvent[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

class ConflictRevision extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        code: "STALE_CONTENT_REVISION",
        message: "This attempt is for an older revision of the game. Reload to continue.",
      },
      HttpStatus.CONFLICT,
    );
  }
}
