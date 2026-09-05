import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEMO_LEARNER_ID,
  modulesResponseSchema,
  pathResponseSchema,
  HEARTS_EMPTY_CODE,
} from "@jose/shared";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { eq } from "drizzle-orm";
import { attempts, learnerProgress, learners, modules } from "../db/schema";
import { HttpException, NotFoundException } from "@nestjs/common";

describe("CurriculumService", () => {
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-api-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still lock the sqlite file briefly.
    }
  });

  it("lists published modules including the featured Rizal path", async () => {
    const body = modulesResponseSchema.parse(await service.listPublishedModules());
    expect(body.modules.some((m) => m.id === "rizal" && m.featured)).toBe(true);
    expect(body.modules.some((m) => m.id === "ateneo-days")).toBe(true);
  });

  it("returns a schema-valid featured path", async () => {
    const path = pathResponseSchema.parse(await service.getFeaturedPath());
    expect(path.sections.length).toBeGreaterThan(0);
  });

  it("unlocks the next Ateneo days level only after the first is finished", async () => {
    await expect(service.getPlayLevel("ateneo-quiz")).rejects.toThrow(
      /previous level/i,
    );
    await service.completeLevel("ateneo-welcome");
    const play = await service.getPlayLevel("ateneo-quiz");
    expect(play.level.kind).toBe("game");
    expect(play.game?.type).toBe("quiz");
  });

  it("refuses to delete the featured module", async () => {
    await expect(service.deleteModule("rizal")).rejects.toThrow(/cannot be deleted/i);
  });

  it("spends a heart on a miss and refills after a lesson", async () => {
    await service.completeLevel("ateneo-welcome");
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    const before = await service.getLearner();
    await service.recordMiss("ateneo-quiz");
    const afterMiss = await service.getLearner();
    expect(afterMiss.hearts).toBe(before.hearts - 1);

    await database.db
      .update(learners)
      .set({ hearts: 1, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    await service.completeLevel("edu-binan");
    expect((await service.getLearner()).hearts).toBe(5);
  });

  it("blocks starting a game at zero hearts", async () => {
    await service.completeLevel("ateneo-welcome");
    await database.db
      .update(learners)
      .set({ hearts: 0, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    try {
      await service.getPlayLevel("ateneo-quiz");
      throw new Error("expected HEARTS_EMPTY");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: HEARTS_EMPTY_CODE,
      });
    }
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
  });

  describe("publication checks (ticket 04)", () => {
    let draftModuleId: string;
    let draftLessonId: string;
    let draftGameId: string;

    beforeAll(async () => {
      const created = await service.createModule({
        title: "Draft only",
        subtitle: "Unpublished fixture",
        coverColor: "#334155",
      });
      draftModuleId = created.id;
      const sectionId = created.sections[0]!.id;
      const lesson = await service.createLevel(sectionId, {
        title: "Secret lesson",
        kind: "lesson",
      });
      draftLessonId = lesson.id;
      await service.putLesson(draftLessonId, {
        markdown: "## Secret\n\nStudents must not see this.",
        youtubeUrl: "",
      });
      const game = await service.createLevel(sectionId, {
        title: "Secret quiz",
        kind: "game",
        gameType: "quiz",
      });
      draftGameId = game.id;
      await service.putGame(draftGameId, {
        type: "quiz",
        questions: [
          {
            prompt: "Hidden?",
            choices: ["Yes", "No"],
            correctIndex: 0,
            why: "Because.",
          },
        ],
      });
      expect(created.published).toBe(false);
    });

    async function learnerSnapshot() {
      const learner = await service.getLearner();
      const progress = await database.db
        .select()
        .from(learnerProgress)
        .where(eq(learnerProgress.learnerId, DEMO_LEARNER_ID));
      const attemptRows = await database.db
        .select()
        .from(attempts)
        .where(eq(attempts.learnerId, DEMO_LEARNER_ID));
      return {
        hearts: learner.hearts,
        xp: learner.xp,
        progressIds: progress.map((row) => row.levelId).sort(),
        attemptCount: attemptRows.length,
        attemptLevelIds: attemptRows.map((row) => row.levelId).sort(),
      };
    }

    it("rejects reading an unpublished lesson by id without revealing content", async () => {
      await expect(service.getPlayLevel(draftLessonId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.getModulePath(draftModuleId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("rejects completing, missing, and attempting unpublished levels without mutating progress", async () => {
      await database.db
        .update(learners)
        .set({ hearts: 5, heartsUpdatedAt: Date.now() })
        .where(eq(learners.id, DEMO_LEARNER_ID));
      const before = await learnerSnapshot();

      await expect(service.completeLevel(draftLessonId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.recordMiss(draftGameId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.submitAttempt(draftGameId, { score: 1, maxScore: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const after = await learnerSnapshot();
      expect(after).toEqual(before);
      expect(after.progressIds).not.toContain(draftLessonId);
      expect(after.progressIds).not.toContain(draftGameId);
      expect(after.attemptLevelIds).not.toContain(draftGameId);
    });

    it("keeps teacher preview available for unpublished levels without student mutations", async () => {
      const before = await learnerSnapshot();
      const preview = await service.getTeachLevel(draftLessonId);
      expect(preview.id).toBe(draftLessonId);
      expect(preview.lesson?.markdown).toMatch(/Secret/);
      const gamePreview = await service.getTeachLevel(draftGameId);
      expect(gamePreview.game?.type).toBe("quiz");
      const after = await learnerSnapshot();
      expect(after).toEqual(before);
    });

    it("omits unpublished featured modules from the student featured path", async () => {
      await database.db
        .update(modules)
        .set({ featured: false })
        .where(eq(modules.id, "rizal"));
      await database.db
        .update(modules)
        .set({ featured: true, published: false })
        .where(eq(modules.id, draftModuleId));

      try {
        await expect(service.getFeaturedPath()).rejects.toBeInstanceOf(
          NotFoundException,
        );
      } finally {
        await database.db
          .update(modules)
          .set({ featured: false, published: false })
          .where(eq(modules.id, draftModuleId));
        await database.db
          .update(modules)
          .set({ featured: true, published: true })
          .where(eq(modules.id, "rizal"));
      }
    });
  });
});
