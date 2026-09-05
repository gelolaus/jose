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

  it("creates a wizard module with lesson+quiz and supports playtest publish path", async () => {
    const created = await service.createModuleFromWizard({
      title: "Studio smoke",
      intendedLearners: "APC RIZLIFE",
      objective: "Explain one sourced claim",
      coverColor: "#22C55E",
    });
    expect(created.published).toBe(false);
    const kinds = created.sections.flatMap((s) => s.levels.map((l) => l.kind));
    expect(kinds).toEqual(expect.arrayContaining(["lesson", "game"]));
    const lesson = created.sections
      .flatMap((s) => s.levels)
      .find((l) => l.kind === "lesson");
    expect(lesson).toBeTruthy();
    const detail = await service.getTeachLevel(lesson!.id);
    expect(detail.lesson?.blocks?.length).toBeGreaterThan(0);
  });

  it("autosave conflict path rejects stale revisions and keeps recoverable content", async () => {
    const mod = await service.createModule({
      title: "Conflict lab",
      subtitle: "two editors",
      coverColor: "#38BDF8",
    });
    const sectionId = mod.sections[0]!.id;
    const level = await service.createLevel(sectionId, {
      title: "Draft lesson",
      kind: "lesson",
    });
    const first = await service.putLesson(level.id, {
      blocks: [
        { type: "text", id: "t1", markdown: "Editor A" },
      ],
      expectedRevision: level.revision,
    });
    try {
      await service.putLesson(level.id, {
        blocks: [{ type: "text", id: "t2", markdown: "Editor B" }],
        expectedRevision: level.revision,
      });
      throw new Error("expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: "CONTENT_CONFLICT",
      });
    }
    const latest = await service.getTeachLevel(level.id);
    expect(latest.lesson?.markdown).toContain("Editor A");
    expect(latest.revision).toBe(first.revision);
  });

  it("keeps add/reorder inputs resilient and rejects missing section adds", async () => {
    const mod = await service.createModule({
      title: "Resilient ops",
      subtitle: "mutations",
      coverColor: "#F97316",
    });
    const sectionId = mod.sections[0]!.id;
    await service.createLevel(sectionId, {
      title: "A",
      kind: "lesson",
    });
    const b = await service.createLevel(sectionId, {
      title: "B",
      kind: "game",
      gameType: "quiz",
    });
    const moved = await service.moveLevel(b.id, { direction: "up" });
    expect(moved.sections[0]!.levels.map((l) => l.title)).toEqual(["B", "A"]);
    await expect(
      service.createLevel("missing-section", {
        title: "Should fail",
        kind: "lesson",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("duplicates modules without publishing or copying student history", async () => {
    const mod = await service.createModuleFromWizard({
      title: "Original",
      intendedLearners: "Class",
      objective: "Obj",
      coverColor: "#EF4444",
      templateId: "lesson-retrieval",
    });
    const published = await service.patchModule(mod.id, {
      published: true,
      expectedRevision: (await service.getTeachModule(mod.id)).revision,
    });
    expect(published.published).toBe(true);
    const lesson = published.sections
      .flatMap((s) => s.levels)
      .find((l) => l.kind === "lesson")!;
    const copy = await service.duplicateModule(mod.id, {});
    expect(copy.published).toBe(false);
    expect(copy.id).not.toBe(mod.id);
    expect(copy.title).toMatch(/copy/i);
    const copiedLesson = copy.sections
      .flatMap((s) => s.levels)
      .find((l) => l.kind === "lesson")!;
    expect(copiedLesson.id).not.toBe(lesson.id);
    const { learnerProgress } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await database.db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.levelId, copiedLesson.id));
    expect(rows).toHaveLength(0);
  });

  it("previews ten-question import errors before commit", async () => {
    const mod = await service.createModule({
      title: "Import lab",
      subtitle: "quiz",
      coverColor: "#FB7185",
    });
    const quiz = await service.createLevel(mod.sections[0]!.id, {
      title: "Quiz",
      kind: "game",
      gameType: "quiz",
    });
    const rows = Array.from({ length: 10 }, (_, i) => ({
      prompt: `Question ${i + 1}`,
      choiceA: "A",
      choiceB: "B",
      correct: i === 2 ? "Q" : "A",
    }));
    const preview = await service.importQuestions(quiz.id, {
      mode: "all-or-nothing",
      format: "json",
      rows,
      commit: false,
    });
    expect(preview.totalRows).toBe(10);
    expect(preview.errorCount).toBe(1);
    expect(preview.errors[0]?.row).toBe(3);
    expect(preview.applied).toBe(false);
    const committed = await service.importQuestions(quiz.id, {
      mode: "partial",
      format: "json",
      rows,
      commit: true,
    });
    expect(committed.applied).toBe(true);
    const latest = await service.getTeachLevel(quiz.id);
    expect(latest.game?.type).toBe("quiz");
    if (latest.game?.type === "quiz") {
      expect(latest.game.questions.length).toBeGreaterThanOrEqual(9);
    }
  });

  it("stores rich lesson blocks and rejects unsafe embeds", async () => {
    const mod = await service.createModule({
      title: "Blocks",
      subtitle: "rich",
      coverColor: "#A855F7",
    });
    const lesson = await service.createLevel(mod.sections[0]!.id, {
      title: "Illustrated",
      kind: "lesson",
    });
    await expect(
      service.putLesson(lesson.id, {
        blocks: [
          {
            type: "image",
            id: "bad",
            src: "javascript:alert(1)",
            alt: "nope",
          },
        ],
        expectedRevision: lesson.revision,
      }),
    ).rejects.toThrow();
    const saved = await service.putLesson(lesson.id, {
      blocks: [
        {
          type: "text",
          id: "t",
          markdown: "A cited lesson",
        },
        {
          type: "quote",
          id: "q",
          text: "Evidence",
          source: "Archive",
          citation: "p.1",
        },
        {
          type: "image",
          id: "img",
          src: "https://placehold.co/400x200.png",
          alt: "Map of Calamba",
          attribution: "Placeholder",
        },
        {
          type: "video",
          id: "v",
          youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          transcript: "Accessible transcript text",
        },
      ],
      expectedRevision: lesson.revision,
    });
    expect(saved.lesson?.blocks?.length).toBe(4);
    expect(saved.lesson?.markdown).toContain("Evidence");
    const play = await service.getPlayLevel(saved.id);
    expect(play.lesson?.blocks?.some((b) => b.type === "quote")).toBe(true);
  });

  it("uploads validated assets into the module source library", async () => {
    const mod = await service.createModule({
      title: "Assets",
      subtitle: "library",
      coverColor: "#22C55E",
    });
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ).toString("base64");
    const asset = await service.createAsset(mod.id, {
      filename: "dot.png",
      mime: "image/png",
      sizeBytes: 68,
      alt: "One pixel",
      attribution: "Test",
      dataBase64: tinyPng,
    });
    expect(asset.src.startsWith("data:image/png;base64,")).toBe(true);
    const listed = await service.listAssets(mod.id);
    expect(listed.some((item) => item.id === asset.id)).toBe(true);
  });
});
