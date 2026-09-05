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
  DEMO_TEACHER_ID,
  HEARTS_EMPTY_CODE,
  MAX_HEARTS,
  applyHeartDrip,
  assessPublishReadiness,
  attemptBodySchema,
  bulkMoveBodySchema,
  createLevelBodySchema,
  createModuleBodySchema,
  createSectionBodySchema,
  deriveLevelStatuses,
  emptyGameContent,
  isLevelLocked,
  moduleRevisionSnapshotSchema,
  moveBodySchema,
  moveSectionBodySchema,
  nodeIconFor,
  parseGameContent,
  parseYoutubeVideoId,
  patchLevelBodySchema,
  patchModuleBodySchema,
  patchSectionBodySchema,
  pathPosition,
  permanentDeleteBodySchema,
  publishModuleBodySchema,
  putGameBodySchema,
  putLessonBodySchema,
  type AuthUser,
  type GameType,
  type Learner,
  type ModuleRevisionSnapshot,
  type ModulesResponse,
  type NodeKind,
  type PathResponse,
  type PlayLevelResponse,
  type PublishReadiness,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  attempts,
  contentAudit,
  gameContent,
  learners,
  learnerProgress,
  lessonContent,
  levels,
  moduleRevisions,
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
      .where(
        and(
          eq(modules.published, true),
          isNull(modules.archivedAt),
          isNull(modules.trashedAt),
        ),
      )
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
    const mod = await this.requirePublishedModule(moduleId);
    return this.buildPathFromRevision(mod);
  }

  async getFeaturedPath(): Promise<PathResponse> {
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
    return this.buildPathFromRevision(mod);
  }

  async getPlayLevel(levelId: string): Promise<PlayLevelResponse> {
    const ctx = await this.levelContext(levelId);
    if (!ctx.module.published || ctx.module.archivedAt || ctx.module.trashedAt) {
      throw new NotFoundException("Level not found");
    }
    if (ctx.level.archivedAt || ctx.section.archivedAt) {
      throw new NotFoundException("Level not found");
    }
    const revision = await this.requirePublishedRevision(ctx.module);
    const snapshot = this.parseSnapshot(revision.snapshotJson);
    const snapLevel = this.findSnapshotLevel(snapshot, levelId);
    if (!snapLevel) throw new NotFoundException("Level not found");
    const ordered = snapshot.sections.flatMap((section) =>
      section.levels.map((level) => level.id),
    );
    const completed = await this.completedSet();
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
    const statuses = deriveLevelStatuses(ordered, completed);
    const status = statuses[levelId] ?? "current";
    const learner = await this.syncedLearner();
    if (snapLevel.kind === "game" && learner.hearts <= 0) {
      throw this.heartsEmpty();
    }
    const section = snapshot.sections.find((item) =>
      item.levels.some((level) => level.id === levelId),
    )!;

    const payload: PlayLevelResponse = {
      learner,
      contentRevisionId: revision.id,
      level: {
        id: snapLevel.id,
        title: snapLevel.title,
        kind: snapLevel.kind,
        status,
        moduleId: snapshot.module.id,
        moduleTitle: snapshot.module.title,
        sectionTitle: section.title,
        gameType: snapLevel.gameType,
      },
    };

    if (snapLevel.kind === "lesson") {
      payload.lesson = snapLevel.lesson ?? { markdown: "", youtubeVideoId: null };
    } else if (snapLevel.kind === "game") {
      payload.game = parseGameContent(snapLevel.game ?? {});
    } else {
      payload.chest = {
        message: `You opened ${snapLevel.title}! Keep walking the path.`,
      };
    }
    return payload;
  }

  async completeLevel(levelId: string, body?: unknown) {
    const ctx = await this.levelContext(levelId);
    if (!ctx.module.published || ctx.module.archivedAt || ctx.module.trashedAt) {
      throw new NotFoundException("Level not found");
    }
    const revisionId =
      body && typeof body === "object" && body && "contentRevisionId" in body
        ? String((body as { contentRevisionId?: string }).contentRevisionId ?? "")
        : (await this.requirePublishedRevision(ctx.module)).id;
    const revision = await this.requireRevision(revisionId || (await this.requirePublishedRevision(ctx.module)).id);
    const snapshot = this.parseSnapshot(revision.snapshotJson);
    const snapLevel = this.findSnapshotLevel(snapshot, levelId);
    if (!snapLevel) throw new NotFoundException("Level not found");
    if (snapLevel.kind === "game") {
      throw new BadRequestException("Finish the game to complete this level");
    }
    const ordered = snapshot.sections.flatMap((section) =>
      section.levels.map((level) => level.id),
    );
    const completed = await this.completedSet();
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
    const first = await this.markComplete(levelId, revision.id);
    if (snapLevel.kind === "lesson") {
      await this.refillHearts();
    }
    const learner = await this.getLearner();
    return { completed: true, firstTime: first, learner, contentRevisionId: revision.id };
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
    if (!ctx.module.published || ctx.module.archivedAt || ctx.module.trashedAt) {
      throw new NotFoundException("Level not found");
    }
    const revisionId =
      data.contentRevisionId ?? (await this.requirePublishedRevision(ctx.module)).id;
    const revision = await this.requireRevision(revisionId);
    if (revision.moduleId !== ctx.module.id) {
      throw new BadRequestException("Revision does not belong to this module");
    }
    const snapshot = this.parseSnapshot(revision.snapshotJson);
    const snapLevel = this.findSnapshotLevel(snapshot, levelId);
    if (!snapLevel || snapLevel.kind !== "game") {
      throw new BadRequestException("Attempts are only for game levels");
    }
    const ordered = snapshot.sections.flatMap((section) =>
      section.levels.map((level) => level.id),
    );
    const completed = await this.completedSet();
    if (isLevelLocked(ordered, completed, levelId)) {
      throw new ForbiddenException("Finish the previous level first");
    }
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
      contentRevisionId: revisionId,
    });
    const first = await this.markComplete(levelId, revisionId);
    const learner = await this.getLearner();
    return { completed: true, firstTime: first, learner, contentRevisionId: revisionId };
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
      .where(and(eq(sections.moduleId, moduleId), isNull(sections.archivedAt)))
      .orderBy(asc(sections.sortOrder));
    const detailSections = [];
    for (const section of sectionRows) {
      const levelRows = await this.db
        .select()
        .from(levels)
        .where(and(eq(levels.sectionId, section.id), isNull(levels.archivedAt)))
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

  async createModule(body: unknown, actor?: AuthUser) {
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
      ownerId: actor?.id ?? DEMO_TEACHER_ID,
      objectives: null,
      authorReviewedAt: null,
      publishedRevisionId: null,
      archivedAt: null,
      trashedAt: null,
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

  async patchModule(moduleId: string, body: unknown, actor?: AuthUser) {
    const data = parseBody(patchModuleBodySchema, body);
    const mod = await this.requireModule(moduleId);
    this.assertCanEditModule(mod, actor);
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
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.patch", data);
    return this.getTeachModule(moduleId);
  }

  async deleteModule(moduleId: string, actor?: AuthUser) {
    return this.archiveModule(moduleId, actor);
  }

  async archiveModule(moduleId: string, actor?: AuthUser) {
    const mod = await this.requireModule(moduleId);
    this.assertCanEditModule(mod, actor);
    if (mod.featured) {
      throw new BadRequestException("The Life of Rizal module cannot be archived");
    }
    const t = Date.now();
    await this.db
      .update(modules)
      .set({ archivedAt: t, trashedAt: t, updatedAt: t, published: false })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.archive", {
      trashedAt: t,
    });
    return { ok: true, archivedAt: t, trashedAt: t };
  }

  async restoreModule(moduleId: string, actor?: AuthUser) {
    const mod = await this.requireModule(moduleId);
    this.assertCanEditModule(mod, actor);
    await this.db
      .update(modules)
      .set({
        archivedAt: null,
        trashedAt: null,
        updatedAt: Date.now(),
        published: Boolean(mod.publishedRevisionId),
      })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.restore", {});
    return this.getTeachModule(moduleId);
  }

  async permanentDeleteModule(moduleId: string, body: unknown, actor?: AuthUser) {
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
    await this.deleteLevelsByModule(moduleId);
    await this.db.delete(sections).where(eq(sections.moduleId, moduleId));
    await this.db.delete(moduleRevisions).where(eq(moduleRevisions.moduleId, moduleId));
    await this.db.delete(modules).where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.permanent_delete", impact);
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
    const siblings = await this.activeSections(moduleId);
    await this.db.insert(sections).values({
      id,
      moduleId,
      title: data.title,
      subtitle: data.subtitle,
      themeColor: data.themeColor,
      sortOrder: siblings.length,
      archivedAt: null,
    });
    await this.normalizeSectionOrder(moduleId);
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

  async deleteSection(sectionId: string, actor?: AuthUser) {
    const section = await this.requireSection(sectionId);
    const mod = await this.requireModule(section.moduleId);
    this.assertCanEditModule(mod, actor);
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
    await this.audit(section.moduleId, actor?.id ?? DEMO_TEACHER_ID, "section.archive", {
      sectionId,
    });
    return this.getTeachModule(section.moduleId);
  }

  async createLevel(sectionId: string, body: unknown) {
    const section = await this.requireSection(sectionId);
    const data = parseBody(createLevelBodySchema, body);
    const id = randomUUID();
    const siblings = await this.activeLevels(sectionId);
    await this.db.insert(levels).values({
      id,
      sectionId,
      title: data.title,
      kind: data.kind,
      gameType: data.kind === "game" ? data.gameType! : null,
      sortOrder: siblings.length,
      archivedAt: null,
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
    await this.normalizeLevelOrder(sectionId);
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

  async deleteLevel(levelId: string, actor?: AuthUser) {
    const ctx = await this.levelContext(levelId);
    this.assertCanEditModule(ctx.module, actor);
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
    await this.audit(ctx.module.id, actor?.id ?? DEMO_TEACHER_ID, "level.archive", {
      levelId,
    });
    return this.getTeachModule(ctx.module.id);
  }

  async moveLevel(levelId: string, body: unknown, actor?: AuthUser) {
    const data = parseBody(moveBodySchema, body);
    const ctx = await this.levelContext(levelId);
    this.assertCanEditModule(ctx.module, actor);
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
    } else if (data.direction) {
      const current = await this.activeLevels(ctx.section.id);
      const index = current.findIndex((row) => row.id === levelId);
      const swapWith = data.direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= current.length) {
        return this.getTeachModule(ctx.module.id);
      }
      if (targetSectionId === ctx.section.id) {
        insertAt = swapWith;
      }
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
    await this.audit(ctx.module.id, actor?.id ?? DEMO_TEACHER_ID, "level.move", {
      levelId,
      targetSectionId,
      insertAt,
    });
    return this.getTeachModule(ctx.module.id);
  }

  async moveSection(sectionId: string, body: unknown, actor?: AuthUser) {
    const data = parseBody(moveSectionBodySchema, body);
    const section = await this.requireSection(sectionId);
    const mod = await this.requireModule(section.moduleId);
    this.assertCanEditModule(mod, actor);
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
    return this.getTeachModule(section.moduleId);
  }

  async bulkMoveLevels(body: unknown, actor?: AuthUser) {
    const data = parseBody(bulkMoveBodySchema, body);
    const target = await this.requireSection(data.targetSectionId);
    const mod = await this.requireModule(target.moduleId);
    this.assertCanEditModule(mod, actor);
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
    return this.getTeachModule(mod.id);
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

  private async buildPath(mod: typeof modules.$inferSelect): Promise<PathResponse> {
    const learner = await this.getLearner();
    const ordered = await this.orderedLevelIds(mod.id);
    const completed = await this.completedSet();
    const statuses = deriveLevelStatuses(ordered, completed);
    const sectionRows = await this.activeSections(mod.id);

    let globalIndex = 0;
    const pathSections = [];
    for (const section of sectionRows) {
      const levelRows = await this.activeLevels(section.id);
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

  private async orderedLevelIds(moduleId: string, includeArchived = false): Promise<string[]> {
    const sectionRows = includeArchived
      ? await this.db
          .select()
          .from(sections)
          .where(eq(sections.moduleId, moduleId))
          .orderBy(asc(sections.sortOrder))
      : await this.activeSections(moduleId);
    const ids: string[] = [];
    for (const section of sectionRows) {
      const levelRows = includeArchived
        ? await this.db
            .select()
            .from(levels)
            .where(eq(levels.sectionId, section.id))
            .orderBy(asc(levels.sortOrder))
        : await this.activeLevels(section.id);
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

  private async markComplete(levelId: string, contentRevisionId?: string | null): Promise<boolean> {
    const completed = await this.completedSet();
    if (completed.has(levelId)) return false;
    await this.db.insert(learnerProgress).values({
      learnerId: DEMO_LEARNER_ID,
      levelId,
      completedAt: Date.now(),
      contentRevisionId: contentRevisionId ?? null,
    });
    const learner = await this.requireLearner();
    await this.db
      .update(learners)
      .set({ xp: learner.xp + FIRST_COMPLETE_XP })
      .where(eq(learners.id, DEMO_LEARNER_ID));
    return true;
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
      ownerId: row.ownerId ?? null,
      objectives: row.objectives ?? null,
      authorReviewedAt: row.authorReviewedAt ?? null,
      publishedRevisionId: row.publishedRevisionId ?? null,
      archivedAt: row.archivedAt ?? null,
      trashedAt: row.trashedAt ?? null,
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
    // Preserve historical attempts/progress; only remove draft content rows.
    await this.db.delete(lessonContent).where(inArray(lessonContent.levelId, ids));
    await this.db.delete(gameContent).where(inArray(gameContent.levelId, ids));
    await this.db.delete(levels).where(inArray(levels.id, ids));
  }

  async getPublishReadiness(moduleId: string): Promise<PublishReadiness> {
    return this.buildPublishReadiness(moduleId, false);
  }

  async publishModule(moduleId: string, body: unknown, actor?: AuthUser) {
    parseBody(publishModuleBodySchema, body);
    const mod = await this.requireModule(moduleId);
    this.assertCanEditModule(mod, actor);
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
    const snapshot = await this.buildDraftSnapshot(moduleId);
    const revisionNumber = await this.nextRevisionNumber(moduleId);
    const revisionId = randomUUID();
    const t = Date.now();
    const note =
      body && typeof body === "object" && body && "note" in body
        ? ((body as { note?: string }).note ?? null)
        : null;
    await this.db.insert(moduleRevisions).values({
      id: revisionId,
      moduleId,
      revisionNumber,
      snapshotJson: JSON.stringify(snapshot),
      createdAt: t,
      createdBy: actor?.id ?? DEMO_TEACHER_ID,
      publishedAt: t,
      note,
    });
    await this.db
      .update(modules)
      .set({
        published: true,
        publishedRevisionId: revisionId,
        authorReviewedAt: t,
        updatedAt: t,
      })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.publish", {
      revisionId,
      revisionNumber,
    });
    return {
      module: await this.getTeachModule(moduleId),
      revision: {
        id: revisionId,
        moduleId,
        revisionNumber,
        createdAt: t,
        createdBy: actor?.id ?? DEMO_TEACHER_ID,
        publishedAt: t,
        note,
      },
      readiness,
    };
  }

  async unpublishModule(moduleId: string, actor?: AuthUser) {
    const mod = await this.requireModule(moduleId);
    this.assertCanEditModule(mod, actor);
    await this.db
      .update(modules)
      .set({ published: false, updatedAt: Date.now() })
      .where(eq(modules.id, moduleId));
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.unpublish", {});
    return this.getTeachModule(moduleId);
  }

  async rollbackModule(moduleId: string, revisionId: string, actor?: AuthUser) {
    const mod = await this.requireModule(moduleId);
    this.assertCanEditModule(mod, actor);
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
    await this.audit(moduleId, actor?.id ?? DEMO_TEACHER_ID, "module.rollback", {
      revisionId,
    });
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
          await this.db
            .insert(lessonContent)
            .values({
              levelId: level.id,
              markdown: level.lesson?.markdown ?? "",
              youtubeVideoId: level.lesson?.youtubeVideoId ?? null,
            })
            .onConflictDoUpdate({
              target: lessonContent.levelId,
              set: {
                markdown: level.lesson?.markdown ?? "",
                youtubeVideoId: level.lesson?.youtubeVideoId ?? null,
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

  private async buildPathFromRevision(
    mod: typeof modules.$inferSelect,
  ): Promise<PathResponse> {
    const revision = await this.requirePublishedRevision(mod);
    const snapshot = this.parseSnapshot(revision.snapshotJson);
    const learner = await this.getLearner();
    const ordered = snapshot.sections.flatMap((section) =>
      section.levels.map((level) => level.id),
    );
    const completed = await this.completedSet();
    const statuses = deriveLevelStatuses(ordered, completed);
    let globalIndex = 0;
    const pathSections = snapshot.sections.map((section) => ({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      themeColor: section.themeColor,
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
    if (!mod.published || mod.archivedAt || mod.trashedAt || !mod.publishedRevisionId) {
      throw new NotFoundException("Module not published");
    }
    return mod;
  }

  private async requirePublishedRevision(mod: typeof modules.$inferSelect) {
    if (!mod.publishedRevisionId) {
      throw new NotFoundException("Module has no published revision");
    }
    return this.requireRevision(mod.publishedRevisionId);
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

  private assertCanEditModule(mod: typeof modules.$inferSelect, actor?: AuthUser) {
    if (!actor) return;
    if (actor.role === "admin") return;
    if (actor.role !== "teacher") {
      throw new ForbiddenException("Teacher access required");
    }
    if (mod.ownerId && mod.ownerId !== actor.id) {
      throw new ForbiddenException("You do not own this module");
    }
  }

  private async audit(
    moduleId: string,
    actorId: string,
    action: string,
    detail: unknown,
  ) {
    await this.db.insert(contentAudit).values({
      id: randomUUID(),
      moduleId,
      actorId,
      action,
      detailJson: JSON.stringify(detail ?? {}),
      createdAt: Date.now(),
    });
  }
}
