import { randomUUID } from "node:crypto";
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
  PRACTICE_RULES,
  PROFILE_RULES,
  applyHeartDrip,
  applyQualifyingActivity,
  attemptBodySchema,
  buildPracticeQueue,
  createLevelBodySchema,
  createModuleBodySchema,
  createSectionBodySchema,
  deriveAchievements,
  deriveLevelStatuses,
  emptyGameContent,
  emptyLessonEditorial,
  gameContentSchema,
  isLevelLocked,
  lessonEditorialSchema,
  moveBodySchema,
  nextLevelAfter,
  nextReviewAt,
  nodeIconFor,
  parseGameContent,
  coerceGameContent,
  parseYoutubeVideoId,
  patchLevelBodySchema,
  patchModuleBodySchema,
  patchSectionBodySchema,
  pathPosition,
  pickContinueLearning,
  practiceAttemptBodySchema,
  putGameBodySchema,
  putLessonBodySchema,
  type ContinueCandidate,
  type ContinueLearning,
  type GameType,
  type Learner,
  type LessonEditorial,
  type ModulesResponse,
  type NodeKind,
  type PathResponse,
  type PlayLevelResponse,
  type PracticeReviewResponse,
  type ProfileStatsResponse,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  attempts,
  gameContent,
  learnerAchievements,
  learners,
  learnerProgress,
  learningMisses,
  lessonContent,
  levels,
  modules,
  practiceAttempts,
  practiceReviews,
  sections,
} from "../db/schema";

const FIRST_COMPLETE_XP = 10;

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

    const completed = await this.completedSet();
    const cards = [];
    const continueCandidates: ContinueCandidate[] = [];

    for (const row of rows) {
      const ordered = await this.orderedLevelIds(row.id);
      const completedCount = ordered.filter((id) => completed.has(id)).length;
      const statuses = deriveLevelStatuses(ordered, completed);
      const currentId =
        ordered.find((id) => statuses[id] === "current") ??
        ordered[ordered.length - 1] ??
        null;
      let nextLevelTitle: string | null = null;
      let nextSectionTitle: string | null = null;
      let nextKind: NodeKind = "lesson";
      if (currentId) {
        const ctx = await this.levelContext(currentId);
        nextLevelTitle = ctx.level.title;
        nextSectionTitle = ctx.section.title;
        nextKind = ctx.level.kind as NodeKind;
        continueCandidates.push({
          moduleId: row.id,
          moduleTitle: row.title,
          featured: row.featured,
          sectionTitle: ctx.section.title,
          levelId: currentId,
          levelTitle: ctx.level.title,
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
    // Core path learning is unlimited — hearts never block coursework.

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
      nextLevelId: nextLevelAfter(ordered, levelId),
      mapHref: `/learn/${ctx.module.id}`,
    };

    if (ctx.level.kind === "lesson") {
      const [content] = await this.db
        .select()
        .from(lessonContent)
        .where(eq(lessonContent.levelId, levelId));
      payload.lesson = {
        markdown: content?.markdown ?? "",
        youtubeVideoId: content?.youtubeVideoId ?? null,
        editorial: this.parseLessonEditorial(content?.editorialJson),
      };
    } else if (ctx.level.kind === "game") {
      const [content] = await this.db
        .select()
        .from(gameContent)
        .where(eq(gameContent.levelId, levelId));
      payload.game = parseGameContent(JSON.parse(content?.json ?? "{}"));
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
    // No heart refill on lesson complete — hearts are arcade-only.
    await this.touchQualifyingActivity();
    await this.syncAchievements();
    const learner = await this.getLearner();
    const ordered = await this.orderedLevelIds(ctx.module.id);
    const nextId = nextLevelAfter(ordered, levelId);
    return {
      completed: true,
      firstTime: first,
      learner,
      nextLevelId: nextId,
      continueHref: nextId
        ? `/learn/${ctx.module.id}/${nextId}`
        : `/learn/${ctx.module.id}`,
    };
  }

  async recordMiss(levelId: string) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Misses are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId);
    // Learning mode: record for practice, never spend hearts or lock out.
    await this.db.insert(learningMisses).values({
      id: randomUUID(),
      learnerId: DEMO_LEARNER_ID,
      levelId,
      createdAt: Date.now(),
    });
    return { learner: await this.getLearner() };
  }

  /** Optional arcade challenge miss — spends a heart. Not used for path learning. */
  async recordArcadeMiss() {
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

  async submitAttempt(levelId: string, body: unknown) {
    const data = parseBody(attemptBodySchema, body);
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Attempts are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId);
    // Path attempts never require hearts.
    await this.db.insert(attempts).values({
      id: randomUUID(),
      learnerId: DEMO_LEARNER_ID,
      levelId,
      score: data.score,
      maxScore: data.maxScore,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: Date.now(),
    });
    const first = await this.markComplete(levelId);
    await this.touchQualifyingActivity();
    await this.syncAchievements();
    const learner = await this.getLearner();
    const ordered = await this.orderedLevelIds(ctx.module.id);
    const nextId = nextLevelAfter(ordered, levelId);
    return {
      completed: true,
      firstTime: first,
      learner,
      nextLevelId: nextId,
      continueHref: nextId
        ? `/learn/${ctx.module.id}/${nextId}`
        : `/learn/${ctx.module.id}`,
    };
  }

  async getPracticeReview(): Promise<PracticeReviewResponse> {
    const now = Date.now();
    const missRows = await this.db
      .select()
      .from(learningMisses)
      .where(eq(learningMisses.learnerId, DEMO_LEARNER_ID))
      .orderBy(desc(learningMisses.createdAt));
    const progressRows = await this.db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, DEMO_LEARNER_ID));
    const reviewRows = await this.db
      .select()
      .from(practiceReviews)
      .where(eq(practiceReviews.learnerId, DEMO_LEARNER_ID));

    const levelMeta: PracticeReviewResponse extends never
      ? never
      : Parameters<typeof buildPracticeQueue>[0]["levelMeta"] = {};

    const published = await this.db
      .select()
      .from(modules)
      .where(eq(modules.published, true));
    for (const mod of published) {
      const sectionRows = await this.db
        .select()
        .from(sections)
        .where(eq(sections.moduleId, mod.id));
      for (const section of sectionRows) {
        const levelRows = await this.db
          .select()
          .from(levels)
          .where(eq(levels.sectionId, section.id));
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

  async submitPracticeAttempt(body: unknown) {
    const data = parseBody(practiceAttemptBodySchema, body);
    const ctx = await this.levelContext(data.levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Practice is only for game levels");
    }
    if (!ctx.module.published) {
      throw new NotFoundException("Level not found");
    }
    const completed = await this.completedSet();
    const [miss] = await this.db
      .select()
      .from(learningMisses)
      .where(
        and(
          eq(learningMisses.learnerId, DEMO_LEARNER_ID),
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
      learnerId: DEMO_LEARNER_ID,
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
          eq(practiceReviews.learnerId, DEMO_LEARNER_ID),
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
            eq(practiceReviews.learnerId, DEMO_LEARNER_ID),
            eq(practiceReviews.levelId, data.levelId),
          ),
        );
    } else {
      await this.db.insert(practiceReviews).values({
        learnerId: DEMO_LEARNER_ID,
        levelId: data.levelId,
        reviewCount,
        nextDueAt,
        updatedAt: now,
      });
    }

    await this.touchQualifyingActivity();
    return {
      saved: true as const,
      marksAssignmentComplete: false as const,
      learner: await this.getLearner(),
    };
  }

  async getProfileStats(): Promise<ProfileStatsResponse> {
    const learner = await this.getLearner();
    const published = await this.db
      .select()
      .from(modules)
      .where(eq(modules.published, true))
      .orderBy(desc(modules.featured), asc(modules.sortOrder));
    const completed = await this.completedSet();
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
        .where(eq(sections.moduleId, mod.id))
        .orderBy(asc(sections.sortOrder));
      for (const section of sectionRows) {
        const levelRows = await this.db
          .select()
          .from(levels)
          .where(eq(levels.sectionId, section.id));
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

    await this.syncAchievements();
    const earnedRows = await this.db
      .select()
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, DEMO_LEARNER_ID));
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

  async getContinueLearning(): Promise<{ continueLearning: ContinueLearning | null }> {
    const listed = await this.listPublishedModules();
    return { continueLearning: listed.continueLearning };
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
        editorialJson: JSON.stringify({
          ...emptyLessonEditorial(),
          contentGaps: [
            "Author objectives, citations, vocabulary, and instructor review before publishing.",
          ],
        }),
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
        editorialJson: JSON.stringify(emptyLessonEditorial()),
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
        editorial: this.parseLessonEditorial(content?.editorialJson),
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
        objectives: this.parseStringArray(section.objectivesJson),
        instructorReviewStatus: (section.instructorReviewStatus ||
          "unreviewed") as "unreviewed" | "needs_revision" | "reviewed",
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

  private async touchQualifyingActivity() {
    const row = await this.requireLearner();
    const update = applyQualifyingActivity(
      row.streak,
      row.lastActivityDay ?? null,
      Date.now(),
    );
    if (!update.changed && row.lastActivityDay === update.lastActivityDay) {
      return;
    }
    await this.db
      .update(learners)
      .set({
        streak: update.streak,
        lastActivityDay: update.lastActivityDay,
      })
      .where(eq(learners.id, DEMO_LEARNER_ID));
  }

  private async syncAchievements() {
    const stats = await this.achievementEvidence();
    const now = Date.now();
    for (const achievement of deriveAchievements(stats)) {
      if (!achievement.unlocked) continue;
      if (stats.previouslyEarned.has(achievement.id)) continue;
      await this.db
        .insert(learnerAchievements)
        .values({
          learnerId: DEMO_LEARNER_ID,
          achievementId: achievement.id,
          earnedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  private async achievementEvidence() {
    const completed = await this.completedSet();
    const published = await this.db
      .select()
      .from(modules)
      .where(eq(modules.published, true));
    let totalLevels = 0;
    let completedLevels = 0;
    let chestsOpened = 0;
    let anyChapterFullyComplete = false;
    let allPublishedComplete = published.length > 0;

    for (const mod of published) {
      const ordered = await this.orderedLevelIds(mod.id);
      totalLevels += ordered.length;
      completedLevels += ordered.filter((id) => completed.has(id)).length;
      if (ordered.some((id) => !completed.has(id))) {
        allPublishedComplete = false;
      }
      const sectionRows = await this.db
        .select()
        .from(sections)
        .where(eq(sections.moduleId, mod.id));
      for (const section of sectionRows) {
        const levelRows = await this.db
          .select()
          .from(levels)
          .where(eq(levels.sectionId, section.id));
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
    }

    const earnedRows = await this.db
      .select()
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, DEMO_LEARNER_ID));

    return {
      hasAnyProgress: completedLevels > 0,
      chestsOpened,
      anyChapterFullyComplete,
      allPublishedComplete: allPublishedComplete && totalLevels > 0,
      previouslyEarned: new Set(earnedRows.map((r) => r.achievementId)),
      earnedAtById: new Map(
        earnedRows.map((r) => [r.achievementId, r.earnedAt] as const),
      ),
    };
  }

  private parseLessonEditorial(raw: string | null | undefined): LessonEditorial {
    if (!raw) return emptyLessonEditorial();
    try {
      const parsed = lessonEditorialSchema.safeParse({
        ...emptyLessonEditorial(),
        ...JSON.parse(raw),
      });
      return parsed.success ? parsed.data : emptyLessonEditorial();
    } catch {
      return emptyLessonEditorial();
    }
  }

  private parseStringArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
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

  private heartsEmpty() {
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: HEARTS_EMPTY_CODE,
        message:
          "Arcade challenge lives are empty. Core learning stays open — try a lesson or practice without challenge mode.",
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
      .delete(practiceAttempts)
      .where(inArray(practiceAttempts.levelId, ids));
    await this.db
      .delete(practiceReviews)
      .where(inArray(practiceReviews.levelId, ids));
    await this.db
      .delete(learningMisses)
      .where(inArray(learningMisses.levelId, ids));
    await this.db
      .delete(learnerProgress)
      .where(inArray(learnerProgress.levelId, ids));
    await this.db.delete(lessonContent).where(inArray(lessonContent.levelId, ids));
    await this.db.delete(gameContent).where(inArray(gameContent.levelId, ids));
    await this.db.delete(levels).where(inArray(levels.id, ids));
  }
}
