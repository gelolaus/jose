import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modulesResponseSchema, pathResponseSchema, HEARTS_EMPTY_CODE } from "@jose/shared";
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

  it("awards a journal artifact once and does not duplicate on repeat", async () => {
    const play = await service.getPlayLevel("childhood-chest");
    expect(play.chest?.artifact.id).toBeTruthy();
    expect(play.chest?.artifact.provenance.length).toBeGreaterThan(10);

    const first = await service.completeLevel("childhood-chest");
    expect(first.artifactAwarded).toBe(true);
    const listed = await service.listArtifacts();
    expect(listed.artifacts.some((a) => a.sourceLevelId === "childhood-chest")).toBe(
      true,
    );

    const second = await service.completeLevel("childhood-chest");
    expect(second.artifactAwarded).toBe(false);
    expect((await service.listArtifacts()).artifacts.filter((a) => a.artifactId === play.chest!.artifact.id)).toHaveLength(1);
  });
});
