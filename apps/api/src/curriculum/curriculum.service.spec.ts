import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  modulesResponseSchema,
  pathResponseSchema,
  practiceReviewResponseSchema,
  profileStatsResponseSchema,
  HEARTS_EMPTY_CODE,
} from "@jose/shared";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { eq } from "drizzle-orm";
import { learners, learningMisses } from "../db/schema";
import { HttpException } from "@nestjs/common";

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
    expect(body.continueLearning?.kind).toBe("resume");
    expect(body.continueLearning?.href).toMatch(/^\/learn\//);
  });

  it("returns a schema-valid featured path", async () => {
    const path = pathResponseSchema.parse(await service.getFeaturedPath());
    expect(path.sections.length).toBeGreaterThan(0);
    expect(path.sections[0]?.objectives).toEqual([]);
  });

  it("unlocks the next Ateneo days level only after the first is finished", async () => {
    await expect(service.getPlayLevel("ateneo-quiz")).rejects.toThrow(
      /previous level/i,
    );
    await service.completeLevel("ateneo-welcome");
    const play = await service.getPlayLevel("ateneo-quiz");
    expect(play.level.kind).toBe("game");
    expect(play.game?.type).toBe("quiz");
    expect(play.nextLevelId).toBeTruthy();
  });

  it("refuses to delete the featured module", async () => {
    await expect(service.deleteModule("rizal")).rejects.toThrow(/cannot be deleted/i);
  });

  it("keeps core learning open at zero hearts and records misses for practice", async () => {
    await service.completeLevel("ateneo-welcome");
    await database.db
      .update(learners)
      .set({ hearts: 0, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));

    const play = await service.getPlayLevel("ateneo-quiz");
    expect(play.level.id).toBe("ateneo-quiz");

    const before = await service.getLearner();
    await service.recordMiss("ateneo-quiz");
    const after = await service.getLearner();
    expect(after.hearts).toBe(before.hearts);

    const misses = await database.db
      .select()
      .from(learningMisses)
      .where(eq(learningMisses.levelId, "ateneo-quiz"));
    expect(misses.length).toBeGreaterThan(0);
  });

  it("still spends hearts only in arcade challenge mode", async () => {
    await database.db
      .update(learners)
      .set({ hearts: 2, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    await service.recordArcadeMiss();
    expect((await service.getLearner()).hearts).toBe(1);

    await database.db
      .update(learners)
      .set({ hearts: 0, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    try {
      await service.recordArcadeMiss();
      throw new Error("expected HEARTS_EMPTY");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: HEARTS_EMPTY_CODE,
      });
    }
  });

  it("builds different practice queues from different misses", async () => {
    await database.db.delete(learningMisses);
    await service.completeLevel("ateneo-welcome");
    await service.recordMiss("ateneo-quiz");
    const review = practiceReviewResponseSchema.parse(
      await service.getPracticeReview(),
    );
    expect(review.items.some((i) => i.levelId === "ateneo-quiz")).toBe(true);
    expect(review.rules.length).toBeGreaterThan(0);

    const saved = await service.submitPracticeAttempt({
      levelId: "ateneo-quiz",
      score: 1,
      maxScore: 1,
    });
    expect(saved.marksAssignmentComplete).toBe(false);
  });

  it("aggregates honest profile stats and keeps achievements monotonic", async () => {
    const stats = profileStatsResponseSchema.parse(await service.getProfileStats());
    expect(stats.totals.completedLevels).toBeGreaterThan(0);
    expect(stats.modules.length).toBeGreaterThan(1);
    expect(stats.achievements.some((a) => a.id === "on-the-path" && a.unlocked)).toBe(
      true,
    );
    expect(stats.rules.hearts).toMatch(/arcade/i);
  });
});
