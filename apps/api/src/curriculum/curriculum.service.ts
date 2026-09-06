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
  DEFAULT_AVATAR_ID,
  HEARTS_EMPTY_CODE,
  MAX_HEARTS,
  applyHeartDrip,
  attemptBodySchema,
  createLevelBodySchema,
  createModuleBodySchema,
  createSectionBodySchema,
  deriveLevelStatuses,
  emptyGameContent,
  gameContentSchema,
  isAvatarId,
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
  type AvatarId,
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
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  attempts,
  gameContent,
  learners,
  learnerProgress,
  lessonContent,
  levels,
  moduleCollaborators,
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

    const cards = [];
    for (const row of rows) {
      const ordered = await this.orderedLevelIds(row.id);
      const completed = await this.completedSet(learnerId);
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
      .where(eq(modules.featured, true))
      .limit(1);
    if (!mod) throw new NotFoundException("No featured module");
    return this.buildPath(mod, learnerId);
  }

  async getPlayLevel(levelId: string, learnerId: string): Promise<PlayLevelResponse> {
    const ctx = await this.levelContext(levelId);
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

  async completeLevel(levelId: string, learnerId: string) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind === "game") {
      throw new BadRequestException("Finish the game to complete this level");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);
    const first = await this.markComplete(levelId, learnerId);
    if (ctx.level.kind === "lesson") {
      await this.refillHearts(learnerId);
    }
    const learner = await this.getLearner(learnerId);
    return { completed: true, firstTime: first, learner };
  }

  async recordMiss(levelId: string, learnerId: string) {
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Misses are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);
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

  async submitAttempt(levelId: string, body: unknown, learnerId: string) {
    const data = parseBody(attemptBodySchema, body);
    const ctx = await this.levelContext(levelId);
    if (ctx.level.kind !== "game") {
      throw new BadRequestException("Attempts are only for game levels");
    }
    await this.ensureUnlocked(ctx.module.id, levelId, learnerId);
    const learnerBefore = await this.syncedLearner(learnerId);
    if (learnerBefore.hearts <= 0) {
      throw this.heartsEmpty();
    }
    await this.db.insert(attempts).values({
      id: randomUUID(),
      learnerId,
      levelId,
      score: data.score,
      maxScore: data.maxScore,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: Date.now(),
    });
    const first = await this.markComplete(levelId, learnerId);
    const learner = await this.getLearner(learnerId);
    return { completed: true, firstTime: first, learner };
  }

  /** Teachers only see modules they own or were explicitly granted; admins see all. */
  async listTeachModules(user: SessionUser): Promise<TeachModule[]> {
    const rows = await this.db
      .select()
      .from(modules)
      .orderBy(desc(modules.featured), asc(modules.sortOrder));
    const result: TeachModule[] = [];
    for (const row of rows) {
      if (user.role !== "admin") {
        const isOwner = row.ownerUserId != null && row.ownerUserId === user.id;
        if (!isOwner) {
          const [grant] = await this.db
            .select()
            .from(moduleCollaborators)
            .where(
              and(
                eq(moduleCollaborators.moduleId, row.id),
                eq(moduleCollaborators.userId, user.id),
              ),
            )
            .limit(1);
          if (!grant) continue;
        }
      }
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

  async createModule(body: unknown, user: SessionUser) {
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
      ownerUserId: user.id,
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

  private async markComplete(levelId: string, learnerId: string): Promise<boolean> {
    const completed = await this.completedSet(learnerId);
    if (completed.has(levelId)) return false;
    await this.db.insert(learnerProgress).values({
      learnerId,
      levelId,
      completedAt: Date.now(),
    });
    const learner = await this.requireLearner(learnerId);
    await this.db
      .update(learners)
      .set({ xp: learner.xp + FIRST_COMPLETE_XP })
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

  private async refillHearts(learnerId: string) {
    await this.db
      .update(learners)
      .set({ hearts: MAX_HEARTS, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, learnerId));
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
