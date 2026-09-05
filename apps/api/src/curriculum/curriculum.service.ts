import { randomUUID } from "node:crypto";
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
  DEMO_LEARNER_ID,
  HEARTS_EMPTY_CODE,
  MAX_ASSET_BYTES,
  MAX_HEARTS,
  applyHeartDrip,
  applyTemplateBodySchema,
  attemptBodySchema,
  blocksToMarkdown,
  createAssetBodySchema,
  createFromWizardBodySchema,
  createLevelBodySchema,
  createModuleBodySchema,
  createSectionBodySchema,
  deriveLevelStatuses,
  duplicateBodySchema,
  emptyGameContent,
  gameContentSchema,
  getModuleTemplate,
  isLevelLocked,
  lessonBlocksSchema,
  listModuleTemplateMeta,
  markdownToStarterBlocks,
  moveBodySchema,
  nodeIconFor,
  parseGameContent,
  coerceGameContent,
  parseImportQuestionsBody,
  parseYoutubeVideoId,
  patchLevelBodySchema,
  patchModuleBodySchema,
  patchSectionBodySchema,
  pathPosition,
  primaryYoutubeIdFromBlocks,
  putGameBodySchema,
  putLessonBodySchema,
  validateQuestionImport,
  type GameContent,
  type GameType,
  type Learner,
  type LessonBlocks,
  type ModulesResponse,
  type NodeKind,
  type PathResponse,
  type PlayLevelResponse,
  type TeachAsset,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  attempts,
  gameContent,
  learners,
  learnerProgress,
  teachAssets,
  lessonContent,
  levels,
  modules,
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
      payload.lesson = this.lessonFromRow(content) ?? {
        markdown: "",
        youtubeVideoId: null,
        blocks: markdownToStarterBlocks(""),
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

  async submitAttempt(levelId: string, body: unknown) {
    const data = parseBody(attemptBodySchema, body);
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Attempts are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId);
    const learnerBefore = await this.syncedLearner();
    if (learnerBefore.hearts <= 0) {
      throw this.heartsEmpty();
    }
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
    const learner = await this.getLearner();
    return { completed: true, firstTime: first, learner };
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
          revision: level.revision ?? 0,
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
      revision: 0,
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

  async createModuleFromWizard(body: unknown) {
    const data = parseBody(createFromWizardBodySchema, body);
    const coverColor = data.coverColor ?? "#7C3AED";
    const created = await this.createModule({
      title: data.title,
      subtitle: `${data.intendedLearners} · ${data.objective}`,
      coverColor,
    });
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

  async patchModule(moduleId: string, body: unknown) {
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
        ...(data.published !== undefined ? { published: data.published } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        updatedAt: Date.now(),
        revision: (mod.revision ?? 0) + 1,
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
      revision: 0,
    });
    if (data.kind === "lesson") {
      const blocks = markdownToStarterBlocks(
        `## ${data.title}\n\nWrite the lesson here.`,
      );
      await this.db.insert(lessonContent).values({
        levelId: id,
        markdown: blocksToMarkdown(blocks),
        youtubeVideoId: null,
        blocksJson: JSON.stringify(blocks),
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

  async duplicateModule(moduleId: string, body: unknown = {}) {
    const data = parseBody(duplicateBodySchema, body);
    const source = await this.getTeachModule(moduleId);
    const created = await this.createModule({
      title: data.title ?? `${source.title} (copy)`,
      subtitle: source.subtitle,
      coverColor: source.coverColor,
    });
    // Remove default empty section levels by replacing structure.
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
      });
      for (const level of section.levels) {
        await this.cloneLevelIntoSection(level.id, newSectionId, level.sortOrder);
      }
    }
    await this.db
      .update(modules)
      .set({ published: false, featured: false, revision: 0, updatedAt: Date.now() })
      .where(eq(modules.id, created.id));
    return this.getTeachModule(created.id);
  }

  async duplicateSection(sectionId: string, body: unknown = {}) {
    const data = parseBody(duplicateBodySchema, body);
    const section = await this.requireSection(sectionId);
    const siblings = await this.db
      .select()
      .from(sections)
      .where(eq(sections.moduleId, section.moduleId));
    const newSectionId = randomUUID();
    await this.db.insert(sections).values({
      id: newSectionId,
      moduleId: section.moduleId,
      title: data.title ?? `${section.title} (copy)`,
      subtitle: section.subtitle,
      themeColor: section.themeColor,
      sortOrder: siblings.length,
    });
    const levelRows = await this.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId))
      .orderBy(asc(levels.sortOrder));
    for (const [index, level] of levelRows.entries()) {
      await this.cloneLevelIntoSection(level.id, newSectionId, index);
    }
    await this.bumpModuleRevision(section.moduleId);
    return this.getTeachModule(section.moduleId);
  }

  async duplicateLevel(levelId: string, body: unknown = {}) {
    const data = parseBody(duplicateBodySchema, body);
    const ctx = await this.levelContext(levelId);
    const siblings = await this.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, ctx.section.id));
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
      updatedAt: row.updatedAt,
      revision: row.revision ?? 0,
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
        }
      | undefined,
  ): NonNullable<TeachLevelDetail["lesson"]> {
    const markdown = content?.markdown ?? "";
    const youtubeVideoId = content?.youtubeVideoId ?? null;
    let blocks: LessonBlocks | undefined;
    if (content?.blocksJson) {
      const parsed = lessonBlocksSchema.safeParse(JSON.parse(content.blocksJson));
      if (parsed.success) blocks = parsed.data;
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
    return { markdown, youtubeVideoId, blocks };
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
    });
    if (source.kind === "lesson" && source.lesson) {
      await this.db.insert(lessonContent).values({
        levelId: id,
        markdown: source.lesson.markdown,
        youtubeVideoId: source.lesson.youtubeVideoId,
        blocksJson: source.lesson.blocks
          ? JSON.stringify(source.lesson.blocks)
          : null,
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
