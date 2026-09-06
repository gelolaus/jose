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
import { learners } from "../db/schema";
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
    const body = modulesResponseSchema.parse(await service.listPublishedModules(DEMO_LEARNER_ID));
    expect(body.modules.some((m) => m.id === "rizal" && m.featured)).toBe(true);
    expect(body.modules.some((m) => m.id === "ateneo-days")).toBe(true);
  });

  it("returns a schema-valid featured path", async () => {
    const path = pathResponseSchema.parse(await service.getFeaturedPath(DEMO_LEARNER_ID));
    expect(path.sections.length).toBeGreaterThan(0);
  });

  it("unlocks the next Ateneo days level only after the first is finished", async () => {
    await expect(service.getPlayLevel("ateneo-quiz", DEMO_LEARNER_ID)).rejects.toThrow(
      /previous level/i,
    );
    await service.completeLevel("ateneo-welcome", DEMO_LEARNER_ID);
    const play = await service.getPlayLevel("ateneo-quiz", DEMO_LEARNER_ID);
    expect(play.level.kind).toBe("game");
    expect(play.game?.type).toBe("quiz");
  });

  it("refuses to delete the featured module", async () => {
    await expect(service.deleteModule("rizal")).rejects.toThrow(/cannot be deleted/i);
  });

  it("spends a heart on a miss and refills after a lesson", async () => {
    await service.completeLevel("ateneo-welcome", DEMO_LEARNER_ID);
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    const before = await service.getLearner(DEMO_LEARNER_ID);
    await service.recordMiss("ateneo-quiz", DEMO_LEARNER_ID);
    const afterMiss = await service.getLearner(DEMO_LEARNER_ID);
    expect(afterMiss.hearts).toBe(before.hearts - 1);

    await database.db
      .update(learners)
      .set({ hearts: 1, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    await service.completeLevel("edu-binan", DEMO_LEARNER_ID);
    expect((await service.getLearner(DEMO_LEARNER_ID)).hearts).toBe(5);
  });

  it("blocks starting a game at zero hearts", async () => {
    await service.completeLevel("ateneo-welcome", DEMO_LEARNER_ID);
    await database.db
      .update(learners)
      .set({ hearts: 0, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, "demo-student"));
    try {
      await service.getPlayLevel("ateneo-quiz", DEMO_LEARNER_ID);
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
});
