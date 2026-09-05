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
  DEMO_LEARNER_ID,
  HEARTS_EMPTY_CODE,
  MAX_HEARTS,
  applyHeartDrip,
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
  isLevelLocked,
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
  stableStringify,
  shuffledCopy,
  type AssessmentSecret,
  type AttemptEvent,
  type EvaluateEventResult,
  type FinishAttemptResult,
  type GameContent,
  type GameType,
  type Learner,
  type ModulesResponse,
  type NodeKind,
  type PathResponse,
  type PlayLevelResponse,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  attempts,
  gameContent,
  learners,
  learnerProgress,
  lessonContent,
  levels,
  modules,
  sections,
} from "../db/schema";

const FIRST_COMPLETE_XP = 10;

type StoredEvent = AttemptEvent & { result: EvaluateEventResult; at: number };

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

function contentRevisionOf(game: GameContent): string {
  return createHash("sha256").update(stableStringify(game)).digest("hex");
}

@Injectable()
export class CurriculumService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async getLearner(): Promise<Learner> {
    return this.syncedLearner();
  }

  async listPublishedModules(): Promise<ModulesResponse> {
    const learner = await this.getLearner();
    const rows = await this.db
      .select()
      .from(modules)
      .where(eq(modules.published, true))
      .orderBy(desc(modules.featured), asc(modules.sortOrder));

    const cards = [];
    for (const row of rows) {
      const ordered = await this.orderedLevelIds(row.id);
      const completed = await this.completedSet();
      const completedCount = ordered.filter((id) => completed.has(id)).length;
      cards.push({
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        coverColor: row.coverColor,
        featured: row.featured,
        published: row.published,
        completedCount,
        totalCount: ordered.length,
      });
    }
    return { learner, modules: cards };
  }

  async getModulePath(moduleId: string): Promise<PathResponse> {
    const mod = await this.requireModule(moduleId);
    if (!mod.published) {
      throw new NotFoundException("Module not published");
    }
    return this.buildPath(mod);
  }

  async getFeaturedPath(): Promise<PathResponse> {
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.featured, true))
      .limit(1);
    if (!mod) throw new NotFoundException("No featured module");
    return this.buildPath(mod);
  }

  async getPlayLevel(levelId: string): Promise<PlayLevelResponse> {
    const ctx = await this.levelContext(levelId);
    const ordered = await this.orderedLevelIds(ctx.module.id);
    const completed = await this.completedSet();
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
    const statuses = deriveLevelStatuses(ordered, completed);
    const status = statuses[levelId] ?? "current";
    const learner = await this.syncedLearner();
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
      const opened = await this.openAssessmentAttempt(levelId, game);
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

  async completeLevel(levelId: string) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind === "game") {
      throw new BadRequestException("Finish the game to complete this level");
    }
    await this.ensureUnlocked(ctx.module.id, levelId);
    const first = await this.markComplete(levelId);
    if (ctx.level.kind === "lesson") {
      await this.refillHearts();
    }
    const learner = await this.getLearner();
    return { completed: true, firstTime: first, learner };
  }

  async recordMiss(levelId: string) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Misses are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId);
    const learner = await this.syncedLearner();
    if (learner.hearts <= 0) {
      throw this.heartsEmpty();
    }
    const leavingFull = learner.hearts >= MAX_HEARTS;
    const row = await this.requireLearner();
    await this.db
      .update(learners)
      .set({
        hearts: learner.hearts - 1,
        heartsUpdatedAt: leavingFull ? Date.now() : row.heartsUpdatedAt,
      })
      .where(eq(learners.id, DEMO_LEARNER_ID));
    return { learner: await this.getLearner() };
  }

  /**
   * Rejects legacy client-scored attempt posts. Assessment finishes must use
   * the server-issued attempt id and answer events.
   */
  async submitAttempt(levelId: string, body: unknown) {
    void levelId;
    if (body && typeof body === "object" && ("score" in body || "maxScore" in body)) {
      throw new BadRequestException(
        "Client scores are not accepted; finish the server-issued attempt instead",
      );
    }
    throw new BadRequestException(
      "Start play via GET /levels/:id, then POST /attempts/:attemptId/finish",
    );
  }

  async evaluateAttempt(attemptId: string, body: unknown): Promise<EvaluateEventResult> {
    const event = parseBody(attemptEventSchema, body);
    const attempt = await this.requireOpenAttempt(attemptId);
    const game = await this.loadGameContent(attempt.levelId);
    this.assertAttemptRevision(attempt.contentRevision, game);

    const secret = this.parseSecret(attempt.secretJson);
    const result = this.gradeEvent(game, secret, event);
    const events = this.parseEvents(attempt.eventsJson);
    events.push({ ...event, result, at: Date.now() });
    await this.db
      .update(attempts)
      .set({ eventsJson: JSON.stringify(events) })
      .where(eq(attempts.id, attemptId));
    return {
      ...result,
      misses: events.reduce((sum, row) => sum + Math.max(0, row.result.misses), 0),
    };
  }

  async finishAttempt(attemptId: string, body: unknown): Promise<FinishAttemptResult> {
    const data = parseBody(finishAttemptBodySchema, body ?? {});
    const attempt = await this.requireAttemptRow(attemptId);
    if (attempt.learnerId !== DEMO_LEARNER_ID) {
      throw new ForbiddenException("This attempt belongs to another learner");
    }
    if (attempt.mode !== "assessment") {
      throw new BadRequestException("Practice attempts are not finished through assessment");
    }

    if (attempt.status === "finished") {
      if (attempt.payload && attempt.payload.includes('"abandoned":true')) {
        throw new BadRequestException("This attempt was abandoned; reload the level");
      }
      const learner = await this.getLearner();
      return {
        attemptId: attempt.id,
        mode: "assessment",
        completed: true,
        firstTime: false,
        score: attempt.score,
        maxScore: attempt.maxScore,
        stars: (attempt.stars === 2 || attempt.stars === 3 ? attempt.stars : 1) as 1 | 2 | 3,
        learner,
        deduplicated: true,
      };
    }

    const ctx = await this.levelContext(attempt.levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Attempts are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, attempt.levelId);
    const learnerBefore = await this.syncedLearner();
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

    await this.db
      .update(attempts)
      .set({
        status: "finished",
        score: graded.score,
        maxScore: graded.maxScore,
        stars: graded.stars,
        finishedAt,
        payload: JSON.stringify({
          misses: graded.misses,
          stars: graded.stars,
          events: events.length,
          answers: data.answers,
          source: "server",
        }),
      })
      .where(and(eq(attempts.id, attemptId), eq(attempts.status, "open")));

    const [fresh] = await this.db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId));
    if (!fresh || fresh.status !== "finished") {
      throw new BadRequestException("Could not finish attempt");
    }

    const first = await this.markComplete(attempt.levelId);
    const learner = await this.getLearner();
    return {
      attemptId: fresh.id,
      mode: "assessment",
      completed: true,
      firstTime: first,
      score: fresh.score,
      maxScore: fresh.maxScore,
      stars: (fresh.stars === 2 || fresh.stars === 3 ? fresh.stars : 1) as 1 | 2 | 3,
      learner,
      deduplicated: fresh.finishedAt !== finishedAt,
    };
  }

  async listTeachModules(): Promise<TeachModule[]> {
    const rows = await this.db
      .select()
      .from(modules)
      .orderBy(desc(modules.featured), asc(modules.sortOrder));
    const result: TeachModule[] = [];
    for (const row of rows) {
      result.push(await this.toTeachModule(row));
    }
    return result;
  }

  async getTeachModule(moduleId: string): Promise<TeachModuleDetail> {
    const mod = await this.requireModule(moduleId);
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, moduleId))
      .orderBy(asc(sections.sortOrder));
    const detailSections = [];
    for (const section of sectionRows) {
      const levelRows = await this.db
        .select()
        .from(levels)
        .where(eq(levels.sectionId, section.id))
        .orderBy(asc(levels.sortOrder));
      detailSections.push({
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
      });
    }
    const summary = await this.toTeachModule(mod);
    return { ...summary, sections: detailSections };
  }

  async createModule(body: unknown) {
    const data = parseBody(createModuleBodySchema, body);
    const id = randomUUID();
    const sectionId = randomUUID();
    const t = Date.now();
    const maxSort = await this.maxModuleSort();
    await this.db.insert(modules).values({
      id,
      title: data.title,
      subtitle: data.subtitle,
      coverColor: data.coverColor,
      sortOrder: maxSort + 1,
      published: false,
      featured: false,
      createdAt: t,
      updatedAt: t,
    });
    await this.db.insert(sections).values({
      id: sectionId,
      moduleId: id,
      title: "Levels",
      subtitle: "Start adding lessons and games",
      themeColor: data.coverColor,
      sortOrder: 0,
    });
    return this.getTeachModule(id);
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
    await this.deleteLevelsByModule(moduleId);
    await this.db.delete(sections).where(eq(sections.moduleId, moduleId));
    await this.db.delete(modules).where(eq(modules.id, moduleId));
    return { ok: true };
  }

  async createSection(moduleId: string, body: unknown) {
    await this.requireModule(moduleId);
    const data = parseBody(createSectionBodySchema, body);
    const id = randomUUID();
    const siblings = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, moduleId));
    await this.db.insert(sections).values({
      id,
      moduleId,
      title: data.title,
      subtitle: data.subtitle,
      themeColor: data.themeColor,
      sortOrder: siblings.length,
    });
    await this.touchModule(moduleId);
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
    const levelRows = await this.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId));
    await this.deleteLevelRows(levelRows.map((l) => l.id));
    await this.db.delete(sections).where(eq(sections.id, sectionId));
    await this.touchModule(section.moduleId);
    return this.getTeachModule(section.moduleId);
  }

  async createLevel(sectionId: string, body: unknown) {
    const section = await this.requireSection(sectionId);
    const data = parseBody(createLevelBodySchema, body);
    const id = randomUUID();
    const siblings = await this.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId));
    await this.db.insert(levels).values({
      id,
      sectionId,
      title: data.title,
      kind: data.kind,
      gameType: data.kind === "game" ? data.gameType! : null,
      sortOrder: siblings.length,
    });
    if (data.kind === "lesson") {
      await this.db.insert(lessonContent).values({
        levelId: id,
        markdown: `## ${data.title}\n\nWrite the lesson here.`,
        youtubeVideoId: null,
      });
    } else {
      await this.db.insert(gameContent).values({
        levelId: id,
        json: JSON.stringify(emptyGameContent(data.gameType!)),
      });
    }
    await this.touchModule(section.moduleId);
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
    await this.deleteLevelRows([levelId]);
    await this.touchModule(ctx.module.id);
    return { ok: true };
  }

  async moveLevel(levelId: string, body: unknown) {
    const data = parseBody(moveBodySchema, body);
    const ctx = await this.levelContext(levelId);
    const siblings = await this.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, ctx.section.id))
      .orderBy(asc(levels.sortOrder));
    const index = siblings.findIndex((row) => row.id === levelId);
    const swapWith = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= siblings.length) {
      return this.getTeachModule(ctx.module.id);
    }
    const a = siblings[index]!;
    const b = siblings[swapWith]!;
    await this.db
      .update(levels)
      .set({ sortOrder: b.sortOrder })
      .where(eq(levels.id, a.id));
    await this.db
      .update(levels)
      .set({ sortOrder: a.sortOrder })
      .where(eq(levels.id, b.id));
    await this.touchModule(ctx.module.id);
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

  private async openAssessmentAttempt(levelId: string, game: GameContent) {
    const revision = contentRevisionOf(game);
    const [existing] = await this.db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.learnerId, DEMO_LEARNER_ID),
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

    await this.db
      .update(attempts)
      .set({
        status: "finished",
        finishedAt: Date.now(),
        payload: JSON.stringify({ abandoned: true }),
      })
      .where(
        and(
          eq(attempts.learnerId, DEMO_LEARNER_ID),
          eq(attempts.levelId, levelId),
          eq(attempts.status, "open"),
        ),
      );

    const built =
      game.type === "memory"
        ? buildMemoryAssessment(game, () => randomUUID())
        : sanitizeGameForAssessment(game);
    const attemptId = randomUUID();
    await this.db.insert(attempts).values({
      id: attemptId,
      learnerId: DEMO_LEARNER_ID,
      levelId,
      contentRevision: revision,
      mode: "assessment",
      status: "open",
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
      for (const [pairIndex, ids] of byPair) {
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

  private async requireOpenAttempt(attemptId: string) {
    const attempt = await this.requireAttemptRow(attemptId);
    if (attempt.learnerId !== DEMO_LEARNER_ID) {
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

  private async buildPath(mod: typeof modules.$inferSelect): Promise<PathResponse> {
    const learner = await this.getLearner();
    const ordered = await this.orderedLevelIds(mod.id);
    const completed = await this.completedSet();
    const statuses = deriveLevelStatuses(ordered, completed);
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, mod.id))
      .orderBy(asc(sections.sortOrder));

    let globalIndex = 0;
    const pathSections = [];
    for (const section of sectionRows) {
      const levelRows = await this.db
        .select()
        .from(levels)
        .where(eq(levels.sectionId, section.id))
        .orderBy(asc(levels.sortOrder));
      pathSections.push({
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
      });
    }

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

  private async orderedLevelIds(moduleId: string): Promise<string[]> {
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

  private async completedSet(): Promise<Set<string>> {
    const rows = await this.db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, DEMO_LEARNER_ID));
    return new Set(rows.map((row) => row.levelId));
  }

  private async ensureUnlocked(moduleId: string, levelId: string) {
    const ordered = await this.orderedLevelIds(moduleId);
    const completed = await this.completedSet();
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
  }

  private async markComplete(levelId: string): Promise<boolean> {
    const completed = await this.completedSet();
    if (completed.has(levelId)) return false;
    await this.db.insert(learnerProgress).values({
      learnerId: DEMO_LEARNER_ID,
      levelId,
      completedAt: Date.now(),
    });
    const learner = await this.requireLearner();
    await this.db
      .update(learners)
      .set({ xp: learner.xp + FIRST_COMPLETE_XP })
      .where(eq(learners.id, DEMO_LEARNER_ID));
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
    };
  }

  private async syncedLearner(): Promise<Learner> {
    const row = await this.requireLearner();
    const dripped = applyHeartDrip(row.hearts, row.heartsUpdatedAt, Date.now());
    if (dripped.changed) {
      await this.db
        .update(learners)
        .set({
          hearts: dripped.hearts,
          heartsUpdatedAt: dripped.heartsUpdatedAt,
        })
        .where(eq(learners.id, DEMO_LEARNER_ID));
    }
    return {
      id: row.id,
      displayName: row.displayName,
      streak: row.streak,
      hearts: dripped.hearts,
      xp: row.xp,
    };
  }

  private async refillHearts() {
    await this.db
      .update(learners)
      .set({ hearts: MAX_HEARTS, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, DEMO_LEARNER_ID));
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

  private async requireLearner() {
    const [row] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, DEMO_LEARNER_ID));
    if (!row) throw new NotFoundException("Demo learner missing");
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

  private async maxModuleSort() {
    const rows = await this.db.select({ sortOrder: modules.sortOrder }).from(modules);
    return rows.reduce((max, row) => Math.max(max, row.sortOrder), -1);
  }

  private async touchModule(moduleId: string) {
    await this.db
      .update(modules)
      .set({ updatedAt: Date.now() })
      .where(eq(modules.id, moduleId));
  }

  private async deleteLevelsByModule(moduleId: string) {
    const sectionRows = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, moduleId));
    const ids: string[] = [];
    for (const section of sectionRows) {
      const levelRows = await this.db
        .select()
        .from(levels)
        .where(eq(levels.sectionId, section.id));
      ids.push(...levelRows.map((l) => l.id));
    }
    await this.deleteLevelRows(ids);
  }

  private async deleteLevelRows(ids: string[]) {
    if (ids.length === 0) return;
    await this.db.delete(attempts).where(inArray(attempts.levelId, ids));
    await this.db
      .delete(learnerProgress)
      .where(inArray(learnerProgress.levelId, ids));
    await this.db.delete(lessonContent).where(inArray(lessonContent.levelId, ids));
    await this.db.delete(gameContent).where(inArray(gameContent.levelId, ids));
    await this.db.delete(levels).where(inArray(levels.id, ids));
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
