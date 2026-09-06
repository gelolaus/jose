import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CONFLICT_CODE,
  DEFAULT_AVATAR_ID,
  HEARTS_EMPTY_CODE,
  MAX_ASSET_BYTES,
  MAX_ATTEMPT_PAYLOAD_BYTES,
  MAX_HEARTS,
  PRACTICE_RULES,
  PROFILE_RULES,
  applyHeartDrip,
  applyQualifyingActivity,
  applyTemplateBodySchema,
  assessPublishReadiness,
  attemptBodySchema,
  attemptEventSchema,
  blocksToMarkdown,
  buildMemoryAssessment,
  buildPracticeQueue,
  bulkMoveBodySchema,
  createAssetBodySchema,
  createFromWizardBodySchema,
  createLevelBodySchema,
  createModuleBodySchema,
  createSectionBodySchema,
  deriveAchievements,
  deriveLevelStatuses,
  duplicateBodySchema,
  emptyGameContent,
  emptyLessonEditorial,
  evaluateBlankChoice,
  evaluateMemoryMatch,
  evaluateQuizChoice,
  evaluateSortCheck,
  evaluateTimelineCheck,
  finishAttemptBodySchema,
  gameContentSchema,
  getModuleTemplate,
  gradeAssessmentFinish,
  instructorReviewStatusSchema,
  isAvatarId,
  isLevelLocked,
  lessonBlocksSchema,
  lessonEditorialSchema,
  listModuleTemplateMeta,
  markdownToStarterBlocks,
  missBodySchema,
  moduleRevisionSnapshotSchema,
  moveBodySchema,
  moveSectionBodySchema,
  nextLevelAfter,
  nextReviewAt,
  nodeIconFor,
  parseGameContent,
  coerceGameContent,
  parseYoutubeVideoId,
  patchLevelBodySchema,
  patchModuleBodySchema,
  patchSectionBodySchema,
  parseImportQuestionsBody,
  pathPosition,
  pickContinueLearning,
  practiceAttemptBodySchema,
  permanentDeleteBodySchema,
  publishModuleBodySchema,
  primaryYoutubeIdFromBlocks,
  putGameBodySchema,
  putLessonBodySchema,
  sanitizeGameForAssessment,
  serializedJsonBytes,
  shuffledCopy,
  stableStringify,
  type AssessmentSecret,
  type AttemptEvent,
  type AvatarId,
  type ContinueCandidate,
  type ContinueLearning,
  type EvaluateEventResult,
  type FinishAttemptResult,
  type GameContent,
  type GameType,
  validateQuestionImport,
  type InstructorReviewStatus,
  type Learner,
  type LessonBlocks,
  type LessonEditorial,
  type ModulesResponse,
  type ModuleRevisionSnapshot,
  type NodeKind,
  type PathResponse,
  type PlayLevelResponse,
  type PracticePlayResponse,
  type PracticeReviewResponse,
  type ProfileStatsResponse,
  type PublishReadiness,
  type SessionUser,
  type TeachAsset,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { DatabaseService, type JoseDb } from "../db/database.service";
import {
  attempts,
  contentAudit,
  gameContent,
  learnerAchievements,
  learners,
  learnerProgress,
  learningMisses,
  lessonContent,
  levels,
  missReceipts,
  moduleCollaborators,
  moduleRevisions,
  modules,
  practiceAttempts,
  practiceReviews,
  sections,
  teachAssets,
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
      .where(
        and(
          eq(modules.published, true),
          isNull(modules.archivedAt),
          isNull(modules.trashedAt),
        ),
      )
      .orderBy(desc(modules.featured), asc(modules.sortOrder));

    const orderedByModule = await this.orderedLevelIdsByModules(rows.map((row) => row.id));
    const completed = await this.completedSet(learnerId);
    const continueCandidates: ContinueCandidate[] = [];
    const currentIds = rows
      .map((row) => {
        const ordered = orderedByModule.get(row.id) ?? [];
        const statuses = deriveLevelStatuses(ordered, completed);
        return (
          ordered.find((id) => statuses[id] === "current") ??
          ordered[ordered.length - 1] ??
          null
        );
      })
      .filter((id): id is string => Boolean(id));
    const headlines = await this.levelHeadlines(currentIds);
    const cards = [];
    for (const row of rows) {
      const ordered = orderedByModule.get(row.id) ?? [];
      const completedCount = ordered.filter((id) => completed.has(id)).length;
      const statuses = deriveLevelStatuses(ordered, completed);
      const currentId =
        ordered.find((id) => statuses[id] === "current") ??
        ordered[ordered.length - 1] ??
        null;
      const headline = currentId ? headlines.get(currentId) : undefined;
      const nextLevelTitle = headline?.title ?? null;
      const nextSectionTitle = headline?.sectionTitle ?? null;
      const nextKind = headline?.kind ?? "lesson";
      if (currentId && headline) {
        continueCandidates.push({
          moduleId: row.id,
          moduleTitle: row.title,
          featured: row.featured,
          sectionTitle: headline.sectionTitle,
          levelId: currentId,
          levelTitle: headline.title,
          levelKind: nextKind,
          completedCount,
          totalCount: ordered.length,
        });
      }
      cards.push({
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        coverColor: row.coverColor,
        featured: row.featured,
        published: row.published,
        completedCount,
        totalCount: ordered.length,
        nextLevelId: currentId,
        nextLevelTitle,
        nextSectionTitle,
      });
    }
    return {
      learner,
      modules: cards,
      continueLearning: pickContinueLearning(continueCandidates),
    };
  }

  async getModulePath(moduleId: string, learnerId: string): Promise<PathResponse> {
    const mod = await this.requirePublishedModule(moduleId);
    return this.buildStudentPath(mod, learnerId);
  }

  async getFeaturedPath(learnerId: string): Promise<PathResponse> {
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.featured, true),
          eq(modules.published, true),
          isNull(modules.archivedAt),
          isNull(modules.trashedAt),
        ),
      )
      .limit(1);
    if (!mod) throw new NotFoundException("No featured module");
    return this.buildStudentPath(mod, learnerId);
  }

  async getPlayLevel(levelId: string, learnerId: string): Promise<PlayLevelResponse> {
    const ctx = await this.requireStudentVisibleLevel(levelId);
    const publishedRevision = await this.publishedRevisionOrNull(ctx.module);
    const snapshot = publishedRevision
      ? this.parseSnapshot(publishedRevision.snapshotJson)
      : null;
    const snapLevel = snapshot ? this.findSnapshotLevel(snapshot, levelId) : null;
    if (snapshot && !snapLevel) {
      throw new NotFoundException("Level not found");
    }
    const ordered = snapshot
      ? snapshot.sections.flatMap((section) => section.levels.map((level) => level.id))
      : await this.orderedLevelIds(ctx.module.id);
    const completed = await this.completedSet(learnerId);
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
    const statuses = deriveLevelStatuses(ordered, completed);
    const status = statuses[levelId] ?? "current";
    const learner = await this.syncedLearner(learnerId);
    const kind = (snapLevel?.kind ?? ctx.level.kind) as NodeKind;
    const title = snapLevel?.title ?? ctx.level.title;
    const gameType = (snapLevel?.gameType ?? ctx.level.gameType) as GameType | null;
    const sectionTitle = snapshot
      ? snapshot.sections.find((section) =>
          section.levels.some((level) => level.id === levelId),
        )?.title ?? ctx.section.title
      : ctx.section.title;
    const moduleTitle = snapshot?.module.title ?? ctx.module.title;
    // Core path learning is unlimited — hearts never block coursework.

    const payload: PlayLevelResponse = {
      learner,
      contentRevisionId: publishedRevision?.id ?? null,
      nextLevelId: nextLevelAfter(ordered, levelId),
      mapHref: `/learn/${ctx.module.id}`,
      level: {
        id: ctx.level.id,
        title,
        kind,
        status,
        moduleId: ctx.module.id,
        moduleTitle,
        sectionTitle,
        gameType,
      },
    };

    if (kind === "lesson") {
      if (snapLevel) {
        payload.lesson = this.lessonFromRow({
          markdown: snapLevel.lesson?.markdown ?? "",
          youtubeVideoId: snapLevel.lesson?.youtubeVideoId ?? null,
          blocksJson: snapLevel.lesson?.blocks
            ? JSON.stringify(snapLevel.lesson.blocks)
            : null,
          editorial: snapLevel.lesson?.editorial,
        });
      } else {
        const [content] = await this.db
          .select()
          .from(lessonContent)
          .where(eq(lessonContent.levelId, levelId));
        payload.lesson = this.lessonFromRow(content);
      }
    } else if (kind === "game") {
      const game = snapLevel
        ? parseGameContent(snapLevel.game ?? {})
        : await this.loadGameContent(levelId);
      const opened = await this.openAssessmentAttempt(
        levelId,
        learnerId,
        game,
        publishedRevision?.id ?? null,
      );
      payload.game = opened.play;
      payload.attempt = {
        id: opened.attemptId,
        contentRevision: opened.contentRevision,
        mode: "assessment",
        status: "open",
      };
    } else {
      payload.chest = {
        message: `You opened ${title}! Keep walking the path.`,
      };
    }
    return payload;
  }

  async completeLevel(levelId: string, learnerId: string) {
    const ctx = await this.requireStudentVisibleLevel(levelId);
    const publishedRevision = await this.publishedRevisionOrNull(ctx.module);
    const snapshot = publishedRevision
      ? this.parseSnapshot(publishedRevision.snapshotJson)
      : null;
    const snapLevel = snapshot ? this.findSnapshotLevel(snapshot, levelId) : null;
    const kind = snapLevel?.kind ?? ctx.level.kind;
    if (kind === "game") {
      throw new BadRequestException("Finish the game to complete this level");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);
    return this.enqueueWrite(async () => {
      const first = await this.db.transaction(async (tx) => {
        return this.markComplete(
          levelId,
          learnerId,
          tx as unknown as JoseDb,
          publishedRevision?.id ?? null,
        );
      });
      await this.touchQualifyingActivity(learnerId);
      await this.syncAchievements(learnerId);
      const learner = await this.getLearner(learnerId);
      const ordered = snapshot
        ? snapshot.sections.flatMap((section) => section.levels.map((level) => level.id))
        : await this.orderedLevelIds(ctx.module.id);
      const nextId = nextLevelAfter(ordered, levelId);
      return {
        completed: true,
        firstTime: first,
        learner,
        contentRevisionId: publishedRevision?.id ?? null,
        nextLevelId: nextId,
        continueHref: nextId
          ? `/learn/${ctx.module.id}/${nextId}`
          : `/learn/${ctx.module.id}`,
      };
    });

  async recordMiss(levelId: string, learnerId: string, body: unknown = {}) {
    const data = parseBody(missBodySchema, body);
    const ctx = await this.requireStudentVisibleLevel(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Misses are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);

    await this.runTx(async (tx) => {
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

      await tx.insert(learningMisses).values({
        id: randomUUID(),
        learnerId,
        levelId,
        createdAt: Date.now(),
      });
    });
    return { learner: await this.getLearner(learnerId) };
  }

  /**
   * Rejects legacy client-scored attempt posts. Assessment finishes must use
   * the server-issued attempt id and answer events.
   */
  async submitAttempt(levelId: string, body: unknown, learnerId: string) {
    const payload =
      body && typeof body === "object" && "payload" in body
        ? (body as { payload?: unknown }).payload
        : undefined;
    if (payload !== undefined) {
      const size = serializedJsonBytes(payload);
      if (size == null) {
        throw new BadRequestException("Attempt payload must be JSON-serializable");
      }
      if (size > MAX_ATTEMPT_PAYLOAD_BYTES) {
        throw new BadRequestException(
          `Attempt payload exceeds ${MAX_ATTEMPT_PAYLOAD_BYTES} bytes`,
        );
      }
    }
    await this.requireStudentVisibleLevel(levelId);
    void learnerId;
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
    const game = await this.loadStudentGame(ctx);
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

    const game = await this.loadStudentGame(ctx);
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
    return this.enqueueWrite(async () => {
      const first = await this.db.transaction(async (tx) => {
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
        return this.markComplete(
          attempt.levelId,
          learnerId,
          tx as unknown as JoseDb,
          attempt.publishedRevisionId ?? ctx.module.publishedRevisionId ?? null,
        );
      });

      const [fresh] = await this.db
        .select()
        .from(attempts)
        .where(eq(attempts.id, attemptId));
      if (!fresh || fresh.status !== "finished") {
        throw new BadRequestException("Could not finish attempt");
      }
      await this.touchQualifyingActivity(learnerId);
      await this.syncAchievements(learnerId);
      return this.finishedAttemptResult(
        fresh,
        learnerId,
        fresh.finishedAt !== finishedAt,
        first,
      );
    });
  }

  async getContinueLearning(
    learnerId: string,
  ): Promise<{ continueLearning: ContinueLearning | null }> {
    const listed = await this.listPublishedModules(learnerId);
    return { continueLearning: listed.continueLearning };
  }

  async recordArcadeMiss(learnerId: string) {
    const learner = await this.syncedLearner(learnerId);
    if (learner.hearts <= 0) {
      throw this.heartsEmpty();
    }
    const leavingFull = learner.hearts >= MAX_HEARTS;
    const row = await this.requireLearner(learnerId);
    await this.db
      .update(learners)
      .set({
        hearts: learner.hearts - 1,
        heartsUpdatedAt: leavingFull ? Date.now() : row.heartsUpdatedAt,
      })
      .where(eq(learners.id, learnerId));
    return { learner: await this.getLearner(learnerId) };
  }

  async getPracticeReview(learnerId: string): Promise<PracticeReviewResponse> {
    const now = Date.now();
    const missRows = await this.db
      .select()
      .from(learningMisses)
      .where(eq(learningMisses.learnerId, learnerId))
      .orderBy(desc(learningMisses.createdAt));
    const progressRows = await this.db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, learnerId));
    const reviewRows = await this.db
      .select()
      .from(practiceReviews)
      .where(eq(practiceReviews.learnerId, learnerId));

    const levelMeta: Parameters<typeof buildPracticeQueue>[0]["levelMeta"] = {};
    const published = await this.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.published, true),
          isNull(modules.archivedAt),
          isNull(modules.trashedAt),
        ),
      );
    for (const mod of published) {
      const sectionRows = await this.db
        .select()
        .from(sections)
        .where(and(eq(sections.moduleId, mod.id), isNull(sections.archivedAt)));
      for (const section of sectionRows) {
        const levelRows = await this.db
          .select()
          .from(levels)
          .where(and(eq(levels.sectionId, section.id), isNull(levels.archivedAt)));
        for (const level of levelRows) {
          let tags: string[] = [];
          try {
            tags = JSON.parse(level.instructorTagsJson || "[]") as string[];
          } catch {
            tags = [];
          }
          levelMeta[level.id] = {
            moduleId: mod.id,
            moduleTitle: mod.title,
            sectionTitle: section.title,
            title: level.title,
            kind: level.kind as NodeKind,
            gameType: (level.gameType as GameType | null) ?? null,
            instructorTags: tags,
          };
        }
      }
    }

    const items = buildPracticeQueue({
      now,
      misses: missRows.map((m) => ({
        levelId: m.levelId,
        createdAt: m.createdAt,
      })),
      completions: progressRows.map((p) => ({
        levelId: p.levelId,
        completedAt: p.completedAt,
      })),
      reviews: reviewRows.map((r) => ({
        levelId: r.levelId,
        reviewCount: r.reviewCount,
        nextDueAt: r.nextDueAt,
      })),
      levelMeta,
    });

    return {
      items,
      rules: [...PRACTICE_RULES],
      emptyMessage:
        items.length === 0
          ? "Complete a path game or make a mistake to unlock personalized practice."
          : "Your review set is ready.",
    };
  }

  async getPracticePlayLevel(
    levelId: string,
    learnerId: string,
  ): Promise<PracticePlayResponse> {
    const ctx = await this.requireStudentVisibleLevel(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Practice is only for game levels");
    }
    const completed = await this.completedSet(learnerId);
    const [miss] = await this.db
      .select()
      .from(learningMisses)
      .where(
        and(
          eq(learningMisses.learnerId, learnerId),
          eq(learningMisses.levelId, levelId),
        ),
      )
      .limit(1);
    if (!completed.has(levelId) && !miss) {
      throw new ForbiddenException(
        "Practice unlocks after you meet this activity on the path",
      );
    }
    const game = await this.loadGameContent(levelId);
    return {
      levelId,
      title: ctx.level.title,
      moduleId: ctx.module.id,
      game,
    };
  }

  async submitPracticeAttempt(learnerId: string, body: unknown) {
    const data = parseBody(practiceAttemptBodySchema, body);
    const ctx = await this.requireStudentVisibleLevel(data.levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Practice is only for game levels");
    }
    const completed = await this.completedSet(learnerId);
    const [miss] = await this.db
      .select()
      .from(learningMisses)
      .where(
        and(
          eq(learningMisses.learnerId, learnerId),
          eq(learningMisses.levelId, data.levelId),
        ),
      )
      .limit(1);
    if (!completed.has(data.levelId) && !miss) {
      throw new ForbiddenException(
        "Practice unlocks after you meet this activity on the path",
      );
    }
    const now = Date.now();
    await this.db.insert(practiceAttempts).values({
      id: randomUUID(),
      learnerId,
      levelId: data.levelId,
      score: data.score,
      maxScore: data.maxScore,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: now,
    });

    const [existing] = await this.db
      .select()
      .from(practiceReviews)
      .where(
        and(
          eq(practiceReviews.learnerId, learnerId),
          eq(practiceReviews.levelId, data.levelId),
        ),
      );
    const reviewCount = (existing?.reviewCount ?? 0) + 1;
    const nextDueAt = nextReviewAt(existing?.reviewCount ?? 0, now);
    if (existing) {
      await this.db
        .update(practiceReviews)
        .set({ reviewCount, nextDueAt, updatedAt: now })
        .where(
          and(
            eq(practiceReviews.learnerId, learnerId),
            eq(practiceReviews.levelId, data.levelId),
          ),
        );
    } else {
      await this.db.insert(practiceReviews).values({
        learnerId,
        levelId: data.levelId,
        reviewCount,
        nextDueAt,
        updatedAt: now,
      });
    }

    await this.touchQualifyingActivity(learnerId);
    return {
      saved: true as const,
      marksAssignmentComplete: false as const,
      learner: await this.getLearner(learnerId),
    };
  }

  async getProfileStats(learnerId: string): Promise<ProfileStatsResponse> {
    const learner = await this.getLearner(learnerId);
    const published = await this.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.published, true),
          isNull(modules.archivedAt),
          isNull(modules.trashedAt),
        ),
      )
      .orderBy(desc(modules.featured), asc(modules.sortOrder));
    const completed = await this.completedSet(learnerId);
    const moduleSummaries = [];
    let totalLevels = 0;
    let completedLevels = 0;
    let chestsOpened = 0;
    let anyChapterFullyComplete = false;
    let allPublishedComplete = published.length > 0;

    for (const mod of published) {
      const ordered = await this.orderedLevelIds(mod.id);
      const done = ordered.filter((id) => completed.has(id)).length;
      totalLevels += ordered.length;
      completedLevels += done;
      if (done < ordered.length) allPublishedComplete = false;

      const sectionRows = await this.db
        .select()
        .from(sections)
        .where(and(eq(sections.moduleId, mod.id), isNull(sections.archivedAt)))
        .orderBy(asc(sections.sortOrder));
      for (const section of sectionRows) {
        const levelRows = await this.db
          .select()
          .from(levels)
          .where(and(eq(levels.sectionId, section.id), isNull(levels.archivedAt)));
        if (
          levelRows.length > 0 &&
          levelRows.every((l) => completed.has(l.id))
        ) {
          anyChapterFullyComplete = true;
        }
        for (const level of levelRows) {
          if (level.kind === "chest" && completed.has(level.id)) {
            chestsOpened += 1;
          }
        }
      }

      moduleSummaries.push({
        moduleId: mod.id,
        title: mod.title,
        featured: mod.featured,
        completedCount: done,
        totalCount: ordered.length,
        coverColor: mod.coverColor,
      });
    }

    await this.syncAchievements(learnerId);
    const earnedRows = await this.db
      .select()
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, learnerId));
    const previouslyEarned = new Set(earnedRows.map((r) => r.achievementId));
    const earnedAtById = new Map(
      earnedRows.map((r) => [r.achievementId, r.earnedAt] as const),
    );

    const achievements = deriveAchievements({
      hasAnyProgress: completedLevels > 0,
      chestsOpened,
      anyChapterFullyComplete,
      allPublishedComplete,
      previouslyEarned,
      earnedAtById,
    });

    return {
      learner,
      modules: moduleSummaries,
      totals: { completedLevels, totalLevels, chestsOpened },
      achievements,
      rules: { ...PROFILE_RULES },
    };
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
      updatedAt: row.updatedAt,
      revision: row.revision ?? 0,
      objectives: row.objectives ?? null,
      authorReviewedAt: row.authorReviewedAt ?? null,
      publishedRevisionId: row.publishedRevisionId ?? null,
      archivedAt: row.archivedAt ?? null,
      trashedAt: row.trashedAt ?? null,
    }));
  }

  async getTeachModule(moduleId: string): Promise<TeachModuleDetail> {
    const mod = await this.requireModule(moduleId);
    const sectionRows = await this.activeSections(moduleId);
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
          revision: level.revision ?? 0,
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
        revision: 0,
        objectives: null,
        authorReviewedAt: null,
        publishedRevisionId: null,
        archivedAt: null,
        trashedAt: null,
        status: "draft",
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

  async createModuleFromWizard(body: unknown, user: SessionUser) {
    const data = parseBody(createFromWizardBodySchema, body);
    const coverColor = data.coverColor ?? "#7C3AED";
    const created = await this.createModule(
      {
        title: data.title,
        subtitle: `${data.intendedLearners} · ${data.objective}`,
        coverColor,
      },
      user,
    );
    if (data.templateId) {
      return this.applyTemplate(created.id, {
        templateId: data.templateId,
        replaceEmptyStarter: true,
      });
    }
    const section = created.sections[0];
    if (section) {
      await this.createLevel(section.id, {
        title: "First lesson",
        kind: "lesson",
      });
      await this.createLevel(section.id, {
        title: "Check understanding",
        kind: "game",
        gameType: "quiz",
      });
    }
    return this.getTeachModule(created.id);
  }

  listTemplates() {
    return listModuleTemplateMeta();
  }

  async applyTemplate(moduleId: string, body: unknown) {
    const data = parseBody(applyTemplateBodySchema, body);
    const mod = await this.requireModule(moduleId);
    const template = getModuleTemplate(data.templateId);
    const detail = await this.getTeachModule(moduleId);
    let sectionId = detail.sections[0]?.id;
    if (data.replaceEmptyStarter) {
      for (const section of detail.sections) {
        for (const level of [...section.levels]) {
          await this.deleteLevelRows([level.id]);
        }
      }
      if (detail.sections[0]) {
        await this.db
          .update(sections)
          .set({
            title: template.sectionTitle,
            subtitle: template.sectionSubtitle,
            themeColor: mod.coverColor,
          })
          .where(eq(sections.id, detail.sections[0].id));
        sectionId = detail.sections[0].id;
      }
    } else {
      const created = await this.createSection(moduleId, {
        title: template.sectionTitle,
        subtitle: template.sectionSubtitle,
        themeColor: mod.coverColor,
      });
      sectionId = created.sections[created.sections.length - 1]!.id;
    }
    if (!sectionId) {
      throw new BadRequestException("Module needs a section for the template");
    }
    for (const seed of template.levels) {
      if (seed.kind === "lesson") {
        const level = await this.createLevel(sectionId, {
          title: seed.title,
          kind: "lesson",
        });
        await this.putLesson(level.id, {
          blocks: seed.blocks,
          markdown: blocksToMarkdown(seed.blocks),
        });
      } else {
        const level = await this.createLevel(sectionId, {
          title: seed.title,
          kind: "game",
          gameType: seed.gameType,
        });
        await this.putGame(level.id, seed.game);
      }
    }
    await this.bumpModuleRevision(moduleId);
    return this.getTeachModule(moduleId);
  }

  async duplicateModule(moduleId: string, body: unknown = {}, user: SessionUser) {
    const data = parseBody(duplicateBodySchema, body);
    const source = await this.getTeachModule(moduleId);
    const created = await this.createModule(
      {
        title: data.title ?? `${source.title} (copy)`,
        subtitle: source.subtitle,
        coverColor: source.coverColor,
      },
      user,
    );
    for (const section of created.sections) {
      await this.db.delete(sections).where(eq(sections.id, section.id));
    }
    for (const section of source.sections) {
      const newSectionId = randomUUID();
      await this.db.insert(sections).values({
        id: newSectionId,
        moduleId: created.id,
        title: section.title,
        subtitle: section.subtitle,
        themeColor: section.themeColor,
        sortOrder: section.sortOrder,
        archivedAt: null,
      });
      for (const level of section.levels) {
        await this.cloneLevelIntoSection(level.id, newSectionId, level.sortOrder);
      }
    }
    await this.db
      .update(modules)
      .set({
        published: false,
        featured: false,
        revision: 0,
        updatedAt: Date.now(),
        publishedRevisionId: null,
        archivedAt: null,
        trashedAt: null,
        status: "draft",
      })
      .where(eq(modules.id, created.id));
    return this.getTeachModule(created.id);
  }

  async duplicateSection(sectionId: string, body: unknown = {}) {
    const data = parseBody(duplicateBodySchema, body);
    const section = await this.requireSection(sectionId);
    const siblings = await this.activeSections(section.moduleId);
    const newSectionId = randomUUID();
    await this.db.insert(sections).values({
      id: newSectionId,
      moduleId: section.moduleId,
      title: data.title ?? `${section.title} (copy)`,
      subtitle: section.subtitle,
      themeColor: section.themeColor,
      sortOrder: siblings.length,
      archivedAt: null,
    });
    const levelRows = await this.activeLevels(sectionId);
    for (const [index, level] of levelRows.entries()) {
      await this.cloneLevelIntoSection(level.id, newSectionId, index);
    }
    await this.bumpModuleRevision(section.moduleId);
    return this.getTeachModule(section.moduleId);
  }

  async duplicateLevel(levelId: string, body: unknown = {}) {
    const data = parseBody(duplicateBodySchema, body);
    const ctx = await this.levelContext(levelId);
    const siblings = await this.activeLevels(ctx.section.id);
    const cloned = await this.cloneLevelIntoSection(
      levelId,
      ctx.section.id,
      siblings.length,
      data.title ?? `${ctx.level.title} (copy)`,
    );
    await this.bumpModuleRevision(ctx.module.id);
    return this.getTeachLevel(cloned);
  }

  async importQuestions(levelId: string, body: unknown) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game" || ctx.level.gameType !== "quiz") {
      throw new BadRequestException("Question import works on quiz levels only");
    }
    const parsed = parseImportQuestionsBody(body);
    const result = validateQuestionImport(parsed);
    if (!parsed.commit) {
      return { ...result, questions: undefined };
    }
    if (result.questions.length === 0) {
      return { ...result, applied: false, questions: undefined };
    }
    if (parsed.mode === "all-or-nothing" && result.errorCount > 0) {
      return { ...result, applied: false, questions: undefined };
    }
    const current = await this.getTeachLevel(levelId);
    const existing =
      current.game && current.game.type === "quiz" ? current.game.questions : [];
    const nextGame: GameContent = {
      type: "quiz",
      questions:
        parsed.mode === "partial"
          ? [...existing, ...result.questions]
          : result.questions,
    };
    const level = await this.putGame(levelId, {
      ...nextGame,
      expectedRevision: current.revision,
    });
    return {
      ...result,
      applied: true,
      questions: undefined,
      level,
    };
  }

  async listAssets(moduleId: string): Promise<TeachAsset[]> {
    await this.requireModule(moduleId);
    const rows = await this.db
      .select()
      .from(teachAssets)
      .where(eq(teachAssets.moduleId, moduleId))
      .orderBy(desc(teachAssets.createdAt));
    return rows.map((row) => this.toTeachAsset(row));
  }

  async createAsset(moduleId: string, body: unknown): Promise<TeachAsset> {
    await this.requireModule(moduleId);
    const data = parseBody(createAssetBodySchema, body);
    if (data.sizeBytes > MAX_ASSET_BYTES) {
      throw new BadRequestException("File is larger than the 2MB limit");
    }
    const approxBytes = Math.floor((data.dataBase64.length * 3) / 4);
    if (approxBytes > MAX_ASSET_BYTES + 1024) {
      throw new BadRequestException("Encoded file exceeds the 2MB limit");
    }
    if (!data.mime.startsWith("image/")) {
      throw new BadRequestException("Only image assets are supported");
    }
    const id = randomUUID();
    await this.db.insert(teachAssets).values({
      id,
      moduleId,
      filename: data.filename,
      mime: data.mime,
      sizeBytes: data.sizeBytes,
      alt: data.alt,
      attribution: data.attribution ?? null,
      dataBase64: data.dataBase64,
      createdAt: Date.now(),
    });
    await this.touchModule(moduleId);
    return this.toTeachAsset({
      id,
      moduleId,
      filename: data.filename,
      mime: data.mime,
      sizeBytes: data.sizeBytes,
      alt: data.alt,
      attribution: data.attribution ?? null,
      dataBase64: data.dataBase64,
      createdAt: Date.now(),
    });
  }

  async getAsset(assetId: string) {
    const [row] = await this.db
      .select()
      .from(teachAssets)
      .where(eq(teachAssets.id, assetId));
    if (!row) throw new NotFoundException("Asset not found");
    return row;
  }

  async moduleIdForAsset(assetId: string) {
    const row = await this.getAsset(assetId);
    return row.moduleId;
  }


  async patchModule(moduleId: string, body: unknown, actor?: SessionUser) {
    const data = parseBody(patchModuleBodySchema, body);
    const mod = await this.requireModule(moduleId);
    this.assertRevision(mod.revision ?? 0, data.expectedRevision);
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
        ...(data.objectives !== undefined ? { objectives: data.objectives } : {}),
        ...(data.authorReviewed !== undefined
          ? { authorReviewedAt: data.authorReviewed ? Date.now() : null }
          : {}),
        ...(data.published !== undefined ? { published: data.published } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        updatedAt: Date.now(),
        revision: (mod.revision ?? 0) + 1,
      })
      .where(eq(modules.id, moduleId));
    if (data.published === true && !mod.publishedRevisionId) {
      await this.freezePublishedRevision(moduleId, actor, "Published via studio toggle");
    }
    await this.audit(moduleId, actor?.id, "module.patch", data);
    return this.getTeachModule(moduleId);
  }

  async deleteModule(moduleId: string, actor?: SessionUser) {
    return this.archiveModule(moduleId, actor);
  }

  async archiveModule(moduleId: string, actor?: SessionUser) {
    const mod = await this.requireModule(moduleId);
    if (mod.featured) {
      throw new BadRequestException("The Life of Rizal module cannot be archived");
    }
    const t = Date.now();
    await this.db
      .update(modules)
      .set({ archivedAt: t, trashedAt: t, updatedAt: t, published: false, status: "archived" })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id, "module.archive", { trashedAt: t });
    return { ok: true, archivedAt: t, trashedAt: t };
  }

  async restoreModule(moduleId: string, actor?: SessionUser) {
    const mod = await this.requireModule(moduleId);
    await this.db
      .update(modules)
      .set({
        archivedAt: null,
        trashedAt: null,
        updatedAt: Date.now(),
        published: Boolean(mod.publishedRevisionId),
        status: mod.publishedRevisionId ? "published" : "draft",
      })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id, "module.restore", {});
    return this.getTeachModule(moduleId);
  }

  async permanentDeleteModule(moduleId: string, body: unknown, actor?: SessionUser) {
    const data = parseBody(permanentDeleteBodySchema, body);
    if (!data.confirm) throw new BadRequestException("Confirmation required");
    const mod = await this.requireModule(moduleId);
    if (actor && actor.role !== "admin") {
      throw new ForbiddenException("Permanent deletion requires admin");
    }
    if (mod.featured) {
      throw new BadRequestException("The Life of Rizal module cannot be deleted");
    }
    if (!mod.trashedAt) {
      throw new BadRequestException("Archive the module before permanent deletion");
    }
    const impact = await this.deletionImpact(moduleId);
    if (impact.attemptCount > 0 || impact.progressCount > 0) {
      throw new BadRequestException({
        message: "Historical attempts/progress block permanent deletion",
        impact,
      });
    }
    await this.runTx(async (tx) => {
      await this.deleteLevelsByModule(moduleId, tx);
      await tx.delete(moduleRevisions).where(eq(moduleRevisions.moduleId, moduleId));
      await tx.delete(contentAudit).where(eq(contentAudit.moduleId, moduleId));
      await tx.delete(sections).where(eq(sections.moduleId, moduleId));
      await tx.delete(modules).where(eq(modules.id, moduleId));
    });
    return { ok: true, impact };
  }

  async deletionImpact(moduleId: string) {
    const levelIds = await this.orderedLevelIds(moduleId, true);
    let attemptCount = 0;
    let progressCount = 0;
    if (levelIds.length > 0) {
      const attemptRows = await this.db
        .select()
        .from(attempts)
        .where(inArray(attempts.levelId, levelIds));
      attemptCount = attemptRows.length;
      const progressRows = await this.db
        .select()
        .from(learnerProgress)
        .where(inArray(learnerProgress.levelId, levelIds));
      progressCount = progressRows.length;
    }
    const revisionRows = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.moduleId, moduleId));
    return {
      attemptCount,
      progressCount,
      revisionCount: revisionRows.length,
      levelCount: levelIds.length,
    };
  }

  async createSection(moduleId: string, body: unknown) {
    await this.requireModule(moduleId);
    const data = parseBody(createSectionBodySchema, body);
    const id = randomUUID();
    await this.runTx(async (tx) => {
      const siblings = await this.activeSections(moduleId);
      await tx.insert(sections).values({
        id,
        moduleId,
        title: data.title,
        subtitle: data.subtitle,
        themeColor: data.themeColor,
        sortOrder: siblings.length,
        archivedAt: null,
      });
      await this.maybeFault("after-section-row");
      await this.touchModule(moduleId, tx);
    });
    await this.normalizeSectionOrder(moduleId);
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

  async deleteSection(sectionId: string, actor?: SessionUser) {
    const section = await this.requireSection(sectionId);
    const siblings = await this.activeSections(section.moduleId);
    if (siblings.length <= 1) {
      throw new BadRequestException("A module needs at least one section");
    }
    const t = Date.now();
    await this.db.update(sections).set({ archivedAt: t }).where(eq(sections.id, sectionId));
    await this.db
      .update(levels)
      .set({ archivedAt: t })
      .where(and(eq(levels.sectionId, sectionId), isNull(levels.archivedAt)));
    await this.normalizeSectionOrder(section.moduleId);
    await this.touchModule(section.moduleId);
    await this.audit(section.moduleId, actor?.id, "section.archive", { sectionId });
    return this.getTeachModule(section.moduleId);
  }

  async createLevel(sectionId: string, body: unknown) {
    const section = await this.requireSection(sectionId);
    const data = parseBody(createLevelBodySchema, body);
    const id = randomUUID();
    await this.runTx(async (tx) => {
      const siblings = await this.activeLevels(sectionId);
      await tx.insert(levels).values({
        id,
        sectionId,
        title: data.title,
        kind: data.kind,
        gameType: data.kind === "game" ? data.gameType! : null,
        sortOrder: siblings.length,
        revision: 0,
        archivedAt: null,
      });
      await this.maybeFault("after-level-row");
      if (data.kind === "lesson") {
        const blocks = markdownToStarterBlocks(
          `## ${data.title}\n\nWrite the lesson here.`,
        );
        await tx.insert(lessonContent).values({
          levelId: id,
          markdown: blocksToMarkdown(blocks),
          youtubeVideoId: null,
          blocksJson: JSON.stringify(blocks),
          editorialJson: JSON.stringify(emptyLessonEditorial()),
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
    const ctx = await this.levelContext(levelId);
    const data = parseBody(patchLevelBodySchema, body);
    this.assertRevision(ctx.level.revision ?? 0, data.expectedRevision);
    if (data.title !== undefined) {
      await this.db
        .update(levels)
        .set({ title: data.title })
        .where(eq(levels.id, levelId));
    }
    await this.bumpLevelRevision(levelId);
    await this.touchModule(ctx.module.id);
    return this.getTeachLevel(levelId);
  }

  async deleteLevel(levelId: string, actor?: SessionUser) {
    const ctx = await this.levelContext(levelId);
    const siblings = await this.activeLevels(ctx.section.id);
    if (siblings.length <= 1) {
      throw new BadRequestException("A section needs at least one level");
    }
    await this.db
      .update(levels)
      .set({ archivedAt: Date.now() })
      .where(eq(levels.id, levelId));
    await this.normalizeLevelOrder(ctx.section.id);
    await this.touchModule(ctx.module.id);
    await this.audit(ctx.module.id, actor?.id, "level.archive", { levelId });
    return this.getTeachModule(ctx.module.id);
  }

  async moveLevel(levelId: string, body: unknown, actor?: SessionUser) {
    const data = parseBody(moveBodySchema, body);
    const ctx = await this.requireAuthorizedTeacherPreview(levelId);
    const simpleSwap =
      Boolean(data.direction) &&
      data.targetSectionId === undefined &&
      data.beforeLevelId === undefined &&
      data.index === undefined;
    if (simpleSwap) {
      await this.runTx(async (tx) => {
        const siblings = await tx
          .select()
          .from(levels)
          .where(and(eq(levels.sectionId, ctx.section.id), isNull(levels.archivedAt)))
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
      await this.normalizeLevelOrder(ctx.section.id);
      await this.audit(ctx.module.id, actor?.id, "level.move", { levelId, direction: data.direction });
      return this.getTeachModule(ctx.module.id);
    }

    const targetSectionId = data.targetSectionId ?? ctx.section.id;
    const targetSection = await this.requireSection(targetSectionId);
    if (targetSection.moduleId !== ctx.module.id) {
      throw new BadRequestException("Cannot move levels across modules");
    }
    const destination = await this.activeLevels(targetSectionId);
    const without = destination.filter((row) => row.id !== levelId);
    let insertAt = without.length;
    if (data.beforeLevelId) {
      const idx = without.findIndex((row) => row.id === data.beforeLevelId);
      if (idx < 0) throw new BadRequestException("beforeLevelId not in target section");
      insertAt = idx;
    } else if (data.index !== undefined) {
      insertAt = Math.min(data.index, without.length);
    }
    const orderedIds = without.map((row) => row.id);
    orderedIds.splice(insertAt, 0, levelId);
    await this.db
      .update(levels)
      .set({ sectionId: targetSectionId })
      .where(eq(levels.id, levelId));
    await this.writeLevelOrder(targetSectionId, orderedIds);
    if (targetSectionId !== ctx.section.id) {
      await this.normalizeLevelOrder(ctx.section.id);
    }
    await this.touchModule(ctx.module.id);
    await this.audit(ctx.module.id, actor?.id, "level.move", {
      levelId,
      targetSectionId,
      insertAt,
    });
    return this.getTeachModule(ctx.module.id);
  }

  async moveSection(sectionId: string, body: unknown, actor?: SessionUser) {
    const data = parseBody(moveSectionBodySchema, body);
    const section = await this.requireSection(sectionId);
    const siblings = await this.activeSections(section.moduleId);
    const index = siblings.findIndex((row) => row.id === sectionId);
    if (index < 0) return this.getTeachModule(section.moduleId);
    let nextIndex = index;
    if (data.direction === "up") nextIndex = index - 1;
    if (data.direction === "down") nextIndex = index + 1;
    if (data.index !== undefined) nextIndex = Math.min(data.index, siblings.length - 1);
    if (nextIndex < 0 || nextIndex >= siblings.length || nextIndex === index) {
      return this.getTeachModule(section.moduleId);
    }
    const ids = siblings.map((row) => row.id);
    ids.splice(index, 1);
    ids.splice(nextIndex, 0, sectionId);
    await this.writeSectionOrder(section.moduleId, ids);
    await this.touchModule(section.moduleId);
    await this.audit(section.moduleId, actor?.id, "section.move", { sectionId, nextIndex });
    return this.getTeachModule(section.moduleId);
  }

  async bulkMoveLevels(body: unknown, actor?: SessionUser) {
    const data = parseBody(bulkMoveBodySchema, body);
    const target = await this.requireSection(data.targetSectionId);
    const mod = await this.requireModule(target.moduleId);
    for (const levelId of data.levelIds) {
      const ctx = await this.levelContext(levelId);
      if (ctx.module.id !== mod.id) {
        throw new BadRequestException("Bulk move is limited to one module");
      }
    }
    const destination = await this.activeLevels(data.targetSectionId);
    const without = destination.filter((row) => !data.levelIds.includes(row.id));
    let insertAt = without.length;
    if (data.beforeLevelId) {
      const idx = without.findIndex((row) => row.id === data.beforeLevelId);
      if (idx < 0) throw new BadRequestException("beforeLevelId not in target section");
      insertAt = idx;
    }
    const orderedIds = without.map((row) => row.id);
    orderedIds.splice(insertAt, 0, ...data.levelIds);
    const sourceSectionIds = new Set<string>();
    for (const levelId of data.levelIds) {
      const ctx = await this.levelContext(levelId);
      sourceSectionIds.add(ctx.section.id);
      await this.db
        .update(levels)
        .set({ sectionId: data.targetSectionId })
        .where(eq(levels.id, levelId));
    }
    await this.writeLevelOrder(data.targetSectionId, orderedIds);
    for (const sectionId of sourceSectionIds) {
      if (sectionId !== data.targetSectionId) await this.normalizeLevelOrder(sectionId);
    }
    await this.touchModule(mod.id);
    await this.audit(mod.id, actor?.id, "level.bulk_move", data);
    return this.getTeachModule(mod.id);
  }

  async putLesson(levelId: string, body: unknown) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "lesson") {
      throw new BadRequestException("This level is not a lesson");
    }
    const data = parseBody(putLessonBodySchema, body);
    this.assertRevision(ctx.level.revision ?? 0, data.expectedRevision);
    let blocks: LessonBlocks | undefined = data.blocks;
    let markdown = data.markdown ?? "";
    let youtubeVideoId: string | null = null;
    if (blocks) {
      markdown = blocksToMarkdown(blocks);
      youtubeVideoId = primaryYoutubeIdFromBlocks(blocks);
    } else {
      blocks = markdownToStarterBlocks(markdown);
      if (data.youtubeUrl && data.youtubeUrl.trim()) {
        youtubeVideoId = parseYoutubeVideoId(data.youtubeUrl);
        if (!youtubeVideoId) {
          throw new BadRequestException("That does not look like a YouTube URL");
        }
        blocks = [
          ...blocks,
          {
            type: "video",
            id: "video-1",
            youtubeVideoId,
            youtubeUrl: data.youtubeUrl,
            transcript: "Transcript not provided yet.",
          },
        ];
      }
    }
    await this.db
      .insert(lessonContent)
      .values({
        levelId,
        markdown,
        youtubeVideoId,
        blocksJson: JSON.stringify(blocks),
        editorialJson: JSON.stringify(emptyLessonEditorial()),
      })
      .onConflictDoUpdate({
        target: lessonContent.levelId,
        set: {
          markdown,
          youtubeVideoId,
          blocksJson: JSON.stringify(blocks),
        },
      });
    await this.bumpLevelRevision(levelId);
    await this.touchModule(ctx.module.id);
    return this.getTeachLevel(levelId);
  }



  async putGame(levelId: string, body: unknown) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("This level is not a game");
    }
    const raw =
      body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};
    const expectedRevision =
      typeof raw.expectedRevision === "number" ? raw.expectedRevision : undefined;
    delete raw.expectedRevision;
    this.assertRevision(ctx.level.revision ?? 0, expectedRevision);
    const data = parseBody(putGameBodySchema, raw);
    await this.db
      .insert(gameContent)
      .values({ levelId, json: JSON.stringify(data) })
      .onConflictDoUpdate({
        target: gameContent.levelId,
        set: { json: JSON.stringify(data) },
      });
    await this.bumpLevelRevision(levelId);
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
      lesson = this.lessonFromRow(content);
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
      revision: ctx.level.revision ?? 0,
      moduleId: ctx.module.id,
      sectionId: ctx.section.id,
      lesson,
      game,
    };
  }

  async getPublishReadiness(moduleId: string): Promise<PublishReadiness> {
    return this.buildPublishReadiness(moduleId, false);
  }

  async publishModule(moduleId: string, body: unknown, actor?: SessionUser) {
    parseBody(publishModuleBodySchema, body);
    const mod = await this.requireModule(moduleId);
    if (mod.archivedAt || mod.trashedAt) {
      throw new BadRequestException("Restore the module before publishing");
    }
    await this.db
      .update(modules)
      .set({ authorReviewedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(modules.id, moduleId));
    const readiness = await this.buildPublishReadiness(moduleId, true);
    if (!readiness.ok) {
      throw new BadRequestException({
        message: "Module is not ready to publish",
        code: "PUBLISH_READINESS",
        readiness,
      });
    }
    const note =
      body && typeof body === "object" && body && "note" in body
        ? ((body as { note?: string }).note ?? null)
        : null;
    const revision = await this.freezePublishedRevision(moduleId, actor, note);
    await this.audit(moduleId, actor?.id, "module.publish", {
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
    });
    return {
      module: await this.getTeachModule(moduleId),
      revision,
      readiness,
    };
  }

  async unpublishModule(moduleId: string, actor?: SessionUser) {
    await this.requireModule(moduleId);
    await this.db
      .update(modules)
      .set({ published: false, updatedAt: Date.now(), status: "draft" })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id, "module.unpublish", {});
    return this.getTeachModule(moduleId);
  }

  async rollbackModule(moduleId: string, revisionId: string, actor?: SessionUser) {
    await this.requireModule(moduleId);
    const revision = await this.requireRevision(revisionId);
    if (revision.moduleId !== moduleId) {
      throw new BadRequestException("Revision does not belong to this module");
    }
    const snapshot = this.parseSnapshot(revision.snapshotJson);
    await this.applySnapshotToDraft(snapshot);
    await this.db
      .update(modules)
      .set({
        title: snapshot.module.title,
        subtitle: snapshot.module.subtitle,
        coverColor: snapshot.module.coverColor,
        objectives: snapshot.module.objectives,
        updatedAt: Date.now(),
      })
      .where(eq(modules.id, moduleId));
    await this.bumpModuleRevision(moduleId);
    await this.audit(moduleId, actor?.id, "module.rollback", { revisionId });
    return this.getTeachModule(moduleId);
  }

  async listRevisions(moduleId: string) {
    await this.requireModule(moduleId);
    const rows = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.moduleId, moduleId))
      .orderBy(desc(moduleRevisions.revisionNumber));
    return rows.map((row) => ({
      id: row.id,
      moduleId: row.moduleId,
      revisionNumber: row.revisionNumber,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      publishedAt: row.publishedAt,
      note: row.note,
    }));
  }

  private async freezePublishedRevision(
    moduleId: string,
    actor?: SessionUser,
    note?: string | null,
  ) {
    const snapshot = await this.buildDraftSnapshot(moduleId);
    const revisionNumber = await this.nextRevisionNumber(moduleId);
    const revisionId = randomUUID();
    const t = Date.now();
    await this.db.insert(moduleRevisions).values({
      id: revisionId,
      moduleId,
      revisionNumber,
      snapshotJson: JSON.stringify(snapshot),
      createdAt: t,
      createdBy: actor?.id ?? "system",
      publishedAt: t,
      note: note ?? null,
    });
    await this.db
      .update(modules)
      .set({
        published: true,
        publishedRevisionId: revisionId,
        authorReviewedAt: t,
        updatedAt: t,
        status: "published",
      })
      .where(eq(modules.id, moduleId));
    return {
      id: revisionId,
      moduleId,
      revisionNumber,
      createdAt: t,
      createdBy: actor?.id ?? "system",
      publishedAt: t,
      note: note ?? null,
    };
  }

  private async buildPublishReadiness(moduleId: string, requireReviewed: boolean) {
    const detail = await this.getTeachModule(moduleId);
    const sectionsInput = [];
    for (const section of detail.sections) {
      const levelsInput = [];
      for (const level of section.levels) {
        const teachLevel = await this.getTeachLevel(level.id);
        levelsInput.push({
          id: level.id,
          title: level.title,
          kind: level.kind,
          gameType: level.gameType,
          sectionId: section.id,
          lesson: teachLevel.lesson,
          game: teachLevel.game,
        });
      }
      sectionsInput.push({
        id: section.id,
        title: section.title,
        levels: levelsInput,
      });
    }
    return assessPublishReadiness({
      id: detail.id,
      title: detail.title,
      objectives: detail.objectives,
      authorReviewed: requireReviewed ? true : Boolean(detail.authorReviewedAt),
      sections: sectionsInput,
    });
  }

  private async buildDraftSnapshot(moduleId: string): Promise<ModuleRevisionSnapshot> {
    const detail = await this.getTeachModule(moduleId);
    const sectionsSnap = [];
    for (const section of detail.sections) {
      const levelsSnap = [];
      for (const level of section.levels) {
        const teachLevel = await this.getTeachLevel(level.id);
        levelsSnap.push({
          id: level.id,
          title: level.title,
          kind: level.kind,
          gameType: level.gameType,
          sortOrder: level.sortOrder,
          lesson: teachLevel.lesson,
          game: teachLevel.game,
        });
      }
      sectionsSnap.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        themeColor: section.themeColor,
        sortOrder: section.sortOrder,
        levels: levelsSnap,
      });
    }
    return moduleRevisionSnapshotSchema.parse({
      module: {
        id: detail.id,
        title: detail.title,
        subtitle: detail.subtitle,
        coverColor: detail.coverColor,
        objectives: detail.objectives,
      },
      sections: sectionsSnap,
    });
  }

  private async applySnapshotToDraft(snapshot: ModuleRevisionSnapshot) {
    for (const section of snapshot.sections) {
      await this.db
        .update(sections)
        .set({
          title: section.title,
          subtitle: section.subtitle,
          themeColor: section.themeColor,
          sortOrder: section.sortOrder,
          archivedAt: null,
        })
        .where(eq(sections.id, section.id));
      for (const level of section.levels) {
        await this.db
          .update(levels)
          .set({
            title: level.title,
            kind: level.kind,
            gameType: level.gameType,
            sortOrder: level.sortOrder,
            sectionId: section.id,
            archivedAt: null,
          })
          .where(eq(levels.id, level.id));
        if (level.kind === "lesson") {
          const blocks = level.lesson?.blocks
            ? JSON.stringify(level.lesson.blocks)
            : null;
          await this.db
            .insert(lessonContent)
            .values({
              levelId: level.id,
              markdown: level.lesson?.markdown ?? "",
              youtubeVideoId: level.lesson?.youtubeVideoId ?? null,
              blocksJson: blocks,
              editorialJson: JSON.stringify(
                level.lesson?.editorial ?? emptyLessonEditorial(),
              ),
            })
            .onConflictDoUpdate({
              target: lessonContent.levelId,
              set: {
                markdown: level.lesson?.markdown ?? "",
                youtubeVideoId: level.lesson?.youtubeVideoId ?? null,
                blocksJson: blocks,
                editorialJson: JSON.stringify(
                  level.lesson?.editorial ?? emptyLessonEditorial(),
                ),
              },
            });
        }
        if (level.kind === "game") {
          await this.db
            .insert(gameContent)
            .values({
              levelId: level.id,
              json: JSON.stringify(level.game ?? {}),
            })
            .onConflictDoUpdate({
              target: gameContent.levelId,
              set: { json: JSON.stringify(level.game ?? {}) },
            });
        }
      }
      await this.normalizeLevelOrder(section.id);
    }
    await this.normalizeSectionOrder(snapshot.module.id);
  }

  private async buildStudentPath(
    mod: typeof modules.$inferSelect,
    learnerId: string,
  ): Promise<PathResponse> {
    const published = await this.publishedRevisionOrNull(mod);
    if (!published) return this.buildPath(mod, learnerId);
    const snapshot = this.parseSnapshot(published.snapshotJson);
    const learner = await this.getLearner(learnerId);
    const ordered = snapshot.sections.flatMap((section) =>
      section.levels.map((level) => level.id),
    );
    const completed = await this.completedSet(learnerId);
    const statuses = deriveLevelStatuses(ordered, completed);
    const liveSections = await this.activeSections(mod.id);
    const liveById = new Map(liveSections.map((section) => [section.id, section]));
    let globalIndex = 0;
    const pathSections = snapshot.sections.map((section) => ({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      themeColor: section.themeColor,
      objectives: this.parseChapterObjectives(liveById.get(section.id)?.objectivesJson),
      instructorReviewStatus: this.parseInstructorReviewStatus(
        liveById.get(section.id)?.instructorReviewStatus,
      ),
      nodes: section.levels.map((level) => {
        const status = statuses[level.id] ?? "locked";
        const node = {
          id: level.id,
          title: level.title,
          kind: level.kind,
          status,
          icon: nodeIconFor(level.kind, status),
          position: pathPosition(globalIndex),
          gameType: level.gameType,
        };
        globalIndex += 1;
        return node;
      }),
    }));
    if (pathSections.length === 0 || pathSections.every((s) => s.nodes.length === 0)) {
      throw new BadRequestException("This module has no levels yet");
    }
    return {
      module: {
        id: snapshot.module.id,
        title: snapshot.module.title,
        subtitle: snapshot.module.subtitle,
        coverColor: snapshot.module.coverColor,
        featured: mod.featured,
      },
      learner,
      sections: pathSections,
    };
  }

  private parseSnapshot(raw: string): ModuleRevisionSnapshot {
    return moduleRevisionSnapshotSchema.parse(JSON.parse(raw));
  }

  private findSnapshotLevel(snapshot: ModuleRevisionSnapshot, levelId: string) {
    for (const section of snapshot.sections) {
      const level = section.levels.find((item) => item.id === levelId);
      if (level) return level;
    }
    return null;
  }

  private async requirePublishedModule(moduleId: string) {
    const mod = await this.requireModule(moduleId);
    if (!mod.published || mod.archivedAt || mod.trashedAt) {
      throw new NotFoundException("Module not published");
    }
    return mod;
  }

  private async publishedRevisionOrNull(mod: typeof modules.$inferSelect) {
    if (!mod.publishedRevisionId) return null;
    const [row] = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, mod.publishedRevisionId));
    return row ?? null;
  }

  private async requireRevision(revisionId: string) {
    const [row] = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, revisionId));
    if (!row) throw new NotFoundException("Revision not found");
    return row;
  }

  private async nextRevisionNumber(moduleId: string) {
    const rows = await this.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.moduleId, moduleId));
    return rows.reduce((max, row) => Math.max(max, row.revisionNumber), 0) + 1;
  }

  private async activeSections(moduleId: string) {
    return this.db
      .select()
      .from(sections)
      .where(and(eq(sections.moduleId, moduleId), isNull(sections.archivedAt)))
      .orderBy(asc(sections.sortOrder));
  }

  private async activeLevels(sectionId: string) {
    return this.db
      .select()
      .from(levels)
      .where(and(eq(levels.sectionId, sectionId), isNull(levels.archivedAt)))
      .orderBy(asc(levels.sortOrder));
  }

  private async normalizeSectionOrder(moduleId: string) {
    const rows = await this.activeSections(moduleId);
    await this.writeSectionOrder(
      moduleId,
      rows.map((row) => row.id),
    );
  }

  private async normalizeLevelOrder(sectionId: string) {
    const rows = await this.activeLevels(sectionId);
    await this.writeLevelOrder(
      sectionId,
      rows.map((row) => row.id),
    );
  }

  private async writeSectionOrder(moduleId: string, ids: string[]) {
    for (const [index, id] of ids.entries()) {
      await this.db
        .update(sections)
        .set({ sortOrder: index })
        .where(and(eq(sections.id, id), eq(sections.moduleId, moduleId)));
    }
  }

  private async writeLevelOrder(sectionId: string, ids: string[]) {
    for (const [index, id] of ids.entries()) {
      await this.db
        .update(levels)
        .set({ sortOrder: index, sectionId })
        .where(eq(levels.id, id));
    }
  }

  private async audit(
    moduleId: string,
    actorId: string | undefined,
    action: string,
    detail: unknown,
  ) {
    await this.db.insert(contentAudit).values({
      id: randomUUID(),
      moduleId,
      actorId: actorId ?? "system",
      action,
      detailJson: JSON.stringify(detail ?? {}),
      createdAt: Date.now(),
    });
  }

  private async loadStudentGame(ctx: {
    module: typeof modules.$inferSelect;
    level: typeof levels.$inferSelect;
  }): Promise<GameContent> {
    const published = await this.publishedRevisionOrNull(ctx.module);
    if (published) {
      const snapshot = this.parseSnapshot(published.snapshotJson);
      const snapLevel = this.findSnapshotLevel(snapshot, ctx.level.id);
      if (snapLevel?.game) return parseGameContent(snapLevel.game);
    }
    return this.loadGameContent(ctx.level.id);
  }

  private async buildPath(
    mod: typeof modules.$inferSelect,
    learnerId: string,
  ): Promise<PathResponse> {
    const learner = await this.getLearner(learnerId);
    const ordered = await this.orderedLevelIds(mod.id);
    const completed = await this.completedSet(learnerId);
    const statuses = deriveLevelStatuses(ordered, completed);
    const sectionRows = await this.activeSections(mod.id);

    const levelsBySection = await this.levelsBySectionIds(sectionRows.map((s) => s.id));
    let globalIndex = 0;
    const pathSections = sectionRows.map((section) => {
      const levelRows = levelsBySection.get(section.id) ?? [];
      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        themeColor: section.themeColor,
        objectives: this.parseChapterObjectives(section.objectivesJson),
        instructorReviewStatus: this.parseInstructorReviewStatus(
          section.instructorReviewStatus,
        ),
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
      .where(
        and(
          inArray(sections.moduleId, moduleIds),
          isNull(sections.archivedAt),
          isNull(levels.archivedAt),
        ),
      );

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

  private async orderedLevelIds(
    moduleId: string,
    includeArchived = false,
  ): Promise<string[]> {
    if (!includeArchived) {
      const map = await this.orderedLevelIdsByModules([moduleId]);
      return map.get(moduleId) ?? [];
    }
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, moduleId))
      .orderBy(asc(sections.sortOrder));
    const ids: string[] = [];
    for (const section of sectionRows) {
      const levelRows = await this.db
        .select()
        .from(levels)
        .where(eq(levels.sectionId, section.id))
        .orderBy(asc(levels.sortOrder));
      for (const level of levelRows) ids.push(level.id);
    }
    return ids;
  }

  private async levelsBySectionIds(sectionIds: string[]) {
    const result = new Map<string, (typeof levels.$inferSelect)[]>();
    for (const id of sectionIds) result.set(id, []);
    if (sectionIds.length === 0) return result;
    const rows = await this.db
      .select()
      .from(levels)
      .where(and(inArray(levels.sectionId, sectionIds), isNull(levels.archivedAt)))
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
      .where(and(inArray(sections.moduleId, moduleIds), isNull(sections.archivedAt)));
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
    const mod = await this.requireModule(moduleId);
    const published = await this.publishedRevisionOrNull(mod);
    const ordered = published
      ? this.parseSnapshot(published.snapshotJson).sections.flatMap((section) =>
          section.levels.map((level) => level.id),
        )
      : await this.orderedLevelIds(moduleId);
    const completed = await this.completedSet(learnerId);
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
  }

  private async markComplete(
    levelId: string,
    learnerId: string,
    executor: JoseDb = this.db,
    publishedRevisionId?: string | null,
  ): Promise<boolean> {
    const inserted = await executor
      .insert(learnerProgress)
      .values({
        learnerId,
        levelId,
        completedAt: Date.now(),
        publishedRevisionId: publishedRevisionId ?? null,
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
    const sectionRows = await this.activeSections(row.id);
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
      updatedAt: row.updatedAt,
      revision: row.revision ?? 0,
      objectives: row.objectives ?? null,
      authorReviewedAt: row.authorReviewedAt ?? null,
      publishedRevisionId: row.publishedRevisionId ?? null,
      archivedAt: row.archivedAt ?? null,
      trashedAt: row.trashedAt ?? null,
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

  private async levelHeadlines(
    levelIds: string[],
  ): Promise<Map<string, { title: string; sectionTitle: string; kind: NodeKind }>> {
    const result = new Map<
      string,
      { title: string; sectionTitle: string; kind: NodeKind }
    >();
    if (levelIds.length === 0) return result;
    const rows = await this.db
      .select({
        id: levels.id,
        title: levels.title,
        kind: levels.kind,
        sectionTitle: sections.title,
      })
      .from(levels)
      .innerJoin(sections, eq(levels.sectionId, sections.id))
      .where(inArray(levels.id, levelIds));
    for (const row of rows) {
      result.set(row.id, {
        title: row.title,
        sectionTitle: row.sectionTitle,
        kind: row.kind as NodeKind,
      });
    }
    return result;
  }

  private async levelContext(levelId: string) {
    const [level] = await this.db.select().from(levels).where(eq(levels.id, levelId));
    if (!level) throw new NotFoundException("Level not found");
    const section = await this.requireSection(level.sectionId);
    const mod = await this.requireModule(section.moduleId);
    return { level, section, module: mod };
  }

  /** Student-visible content: requires the module to be published and not archived. */
  private async requireStudentVisibleLevel(levelId: string) {
    const ctx = await this.levelContext(levelId);
    if (!ctx.module.published || ctx.module.archivedAt || ctx.module.trashedAt) {
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


  private async bumpModuleRevision(moduleId: string) {
    const mod = await this.requireModule(moduleId);
    await this.db
      .update(modules)
      .set({
        updatedAt: Date.now(),
        revision: (mod.revision ?? 0) + 1,
      })
      .where(eq(modules.id, moduleId));
  }

  private async bumpLevelRevision(levelId: string) {
    const [level] = await this.db.select().from(levels).where(eq(levels.id, levelId));
    if (!level) return;
    await this.db
      .update(levels)
      .set({ revision: (level.revision ?? 0) + 1 })
      .where(eq(levels.id, levelId));
  }

  private assertRevision(current: number, expected?: number) {
    if (expected === undefined) return;
    if (expected !== current) {
      throw new ConflictException({
        statusCode: 409,
        code: CONFLICT_CODE,
        message: "This draft changed in another editor. Reload or overwrite carefully.",
        currentRevision: current,
      });
    }
  }

  private lessonFromRow(
    content:
      | {
          markdown: string;
          youtubeVideoId: string | null;
          blocksJson?: string | null;
          editorialJson?: string | null;
          editorial?: LessonEditorial;
        }
      | undefined,
  ): NonNullable<TeachLevelDetail["lesson"]> {
    const markdown = content?.markdown ?? "";
    const youtubeVideoId = content?.youtubeVideoId ?? null;
    let blocks: LessonBlocks | undefined;
    if (content?.blocksJson) {
      try {
        const parsed = lessonBlocksSchema.safeParse(JSON.parse(content.blocksJson));
        if (parsed.success) blocks = parsed.data;
      } catch {
        blocks = undefined;
      }
    }
    if (!blocks) {
      blocks = markdownToStarterBlocks(markdown);
      if (youtubeVideoId) {
        blocks = [
          ...blocks,
          {
            type: "video",
            id: "legacy-video",
            youtubeVideoId,
            transcript: "Transcript not provided yet.",
          },
        ];
      }
    }
    const editorial =
      content?.editorial ?? this.parseLessonEditorial(content?.editorialJson);
    return { markdown, youtubeVideoId, blocks, editorial };
  }

  private parseInstructorReviewStatus(
    raw?: string | null,
  ): InstructorReviewStatus {
    const parsed = instructorReviewStatusSchema.safeParse(raw);
    return parsed.success ? parsed.data : "unreviewed";
  }

  private parseChapterObjectives(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  private parseLessonEditorial(raw?: string | null): LessonEditorial {
    if (!raw) return emptyLessonEditorial();
    try {
      const parsed = lessonEditorialSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : emptyLessonEditorial();
    } catch {
      return emptyLessonEditorial();
    }
  }

  private async touchQualifyingActivity(learnerId: string, now = Date.now()) {
    const row = await this.requireLearner(learnerId);
    const update = applyQualifyingActivity(
      row.streak,
      row.lastActivityDay ?? null,
      now,
    );
    if (!update.changed && update.lastActivityDay === row.lastActivityDay) {
      return;
    }
    await this.db
      .update(learners)
      .set({
        streak: update.streak,
        lastActivityDay: update.lastActivityDay,
      })
      .where(eq(learners.id, learnerId));
  }

  private async syncAchievements(learnerId: string) {
    const statsHint = await this.achievementEvidence(learnerId);
    const achievements = deriveAchievements(statsHint);
    const now = Date.now();
    for (const item of achievements) {
      if (!item.unlocked) continue;
      await this.db
        .insert(learnerAchievements)
        .values({
          learnerId,
          achievementId: item.id,
          earnedAt: item.earnedAt ?? now,
        })
        .onConflictDoNothing();
    }
  }

  private async achievementEvidence(learnerId: string) {
    const published = await this.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.published, true),
          isNull(modules.archivedAt),
          isNull(modules.trashedAt),
        ),
      );
    const completed = await this.completedSet(learnerId);
    let totalLevels = 0;
    let completedLevels = 0;
    let chestsOpened = 0;
    let anyChapterFullyComplete = false;
    let allPublishedComplete = published.length > 0;
    for (const mod of published) {
      const ordered = await this.orderedLevelIds(mod.id);
      const done = ordered.filter((id) => completed.has(id)).length;
      totalLevels += ordered.length;
      completedLevels += done;
      if (done < ordered.length) allPublishedComplete = false;
      const sectionRows = await this.db
        .select()
        .from(sections)
        .where(and(eq(sections.moduleId, mod.id), isNull(sections.archivedAt)));
      for (const section of sectionRows) {
        const levelRows = await this.db
          .select()
          .from(levels)
          .where(and(eq(levels.sectionId, section.id), isNull(levels.archivedAt)));
        if (levelRows.length > 0 && levelRows.every((l) => completed.has(l.id))) {
          anyChapterFullyComplete = true;
        }
        for (const level of levelRows) {
          if (level.kind === "chest" && completed.has(level.id)) chestsOpened += 1;
        }
      }
    }
    void totalLevels;
    const earnedRows = await this.db
      .select()
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, learnerId));
    return {
      hasAnyProgress: completedLevels > 0,
      chestsOpened,
      anyChapterFullyComplete,
      allPublishedComplete,
      previouslyEarned: new Set(earnedRows.map((r) => r.achievementId)),
      earnedAtById: new Map(earnedRows.map((r) => [r.achievementId, r.earnedAt] as const)),
    };
  }

  private async cloneLevelIntoSection(
    sourceLevelId: string,
    sectionId: string,
    sortOrder: number,
    titleOverride?: string,
  ) {
    const source = await this.getTeachLevel(sourceLevelId);
    const id = randomUUID();
    await this.db.insert(levels).values({
      id,
      sectionId,
      title: titleOverride ?? source.title,
      kind: source.kind,
      gameType: source.gameType,
      sortOrder,
      revision: 0,
      archivedAt: null,
    });
    if (source.kind === "lesson" && source.lesson) {
      await this.db.insert(lessonContent).values({
        levelId: id,
        markdown: source.lesson.markdown,
        youtubeVideoId: source.lesson.youtubeVideoId,
        blocksJson: source.lesson.blocks
          ? JSON.stringify(source.lesson.blocks)
          : null,
        editorialJson: JSON.stringify(
          source.lesson.editorial ?? emptyLessonEditorial(),
        ),
      });
    }
    if (source.kind === "game" && source.game) {
      await this.db.insert(gameContent).values({
        levelId: id,
        json: JSON.stringify(source.game),
      });
    }
    return id;
  }

  private toTeachAsset(row: typeof teachAssets.$inferSelect): TeachAsset {
    return {
      id: row.id,
      moduleId: row.moduleId,
      filename: row.filename,
      mime: row.mime as TeachAsset["mime"],
      sizeBytes: row.sizeBytes,
      alt: row.alt,
      attribution: row.attribution,
      src: `data:${row.mime};base64,${row.dataBase64}`,
      createdAt: row.createdAt,
    };
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
    await executor.delete(learningMisses).where(inArray(learningMisses.levelId, ids));
    await executor.delete(practiceAttempts).where(inArray(practiceAttempts.levelId, ids));
    await executor.delete(practiceReviews).where(inArray(practiceReviews.levelId, ids));
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
    const ctx = await this.requireStudentVisibleLevel(attempt.levelId);
    const ordered = await this.orderedLevelIds(ctx.module.id);
    const nextId = nextLevelAfter(ordered, attempt.levelId);
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
      nextLevelId: nextId,
      continueHref: nextId
        ? `/learn/${ctx.module.id}/${nextId}`
        : `/learn/${ctx.module.id}`,
    };
  }

  private async openAssessmentAttempt(
    levelId: string,
    learnerId: string,
    game: GameContent,
    publishedRevisionId?: string | null,
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
        publishedRevisionId: publishedRevisionId ?? null,
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
