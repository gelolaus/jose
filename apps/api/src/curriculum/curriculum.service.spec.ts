import { Test, type TestingModule } from "@nestjs/testing";
import { HttpException, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  DEMO_LEARNER_ID,
  modulesResponseSchema,
  pathResponseSchema,
  type SessionUser,
} from "@jose/shared";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { attempts, gameContent, learnerProgress, learners, moduleRevisions, modules } from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";

function teacherUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

describe("CurriculumService", () => {
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let student: TestAccount;
  let teacher: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-api-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "curriculum-spec-secret-at-least-32!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    student = await createTestAccount(database, {
      admissionEmail: "student@student.apc.edu.ph",
      displayName: "Student",
    });
    teacher = await createTestAccount(database, {
      admissionEmail: "teacher@apc.edu.ph",
      displayName: "Teacher",
      role: "teacher",
    });
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("lists published modules including the featured Rizal path", async () => {
    const body = modulesResponseSchema.parse(
      await service.listPublishedModules(student.learnerId),
    );
    expect(body.modules.some((m) => m.id === "rizal" && m.featured)).toBe(true);
    expect(body.modules.some((m) => m.id === "ateneo-days")).toBe(true);
  });

  it("returns a schema-valid featured path", async () => {
    const path = pathResponseSchema.parse(await service.getFeaturedPath(student.learnerId));
    expect(path.sections.length).toBeGreaterThan(0);
  });

  it("unlocks the next Ateneo days level only after the first is finished", async () => {
    await expect(service.getPlayLevel("ateneo-quiz", student.learnerId)).rejects.toThrow(
      /previous level/i,
    );
    await service.completeLevel("ateneo-welcome", student.learnerId);
    const play = await service.getPlayLevel("ateneo-quiz", student.learnerId);
    expect(play.level.kind).toBe("game");
    expect(play.game?.type).toBe("quiz");
    expect(play.attempt?.mode).toBe("assessment");
    expect(JSON.stringify(play.game)).not.toMatch(/correctIndex/);
  });

  it("refuses to archive the featured module", async () => {
    await expect(service.deleteModule("rizal")).rejects.toThrow(/cannot be archived/i);
  });

  it("records path misses for practice without spending hearts or locking the game", async () => {
    await service.completeLevel("ateneo-welcome", student.learnerId);
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));
    const before = await service.getLearner(student.learnerId);
    await service.recordMiss("ateneo-quiz", student.learnerId, {
      idempotencyKey: `miss-${randomUUID()}`,
    });
    const afterMiss = await service.getLearner(student.learnerId);
    expect(afterMiss.hearts).toBe(before.hearts);

    await database.db
      .update(learners)
      .set({ hearts: 1, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));
    await service.completeLevel("childhood-born", student.learnerId);
    expect((await service.getLearner(student.learnerId)).hearts).toBe(1);
  });

  it("still lets a student start a path game at zero hearts", async () => {
    await service.completeLevel("ateneo-welcome", student.learnerId);
    await database.db
      .update(learners)
      .set({ hearts: 0, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));
    const play = await service.getPlayLevel("ateneo-quiz", student.learnerId);
    expect(play.level.kind).toBe("game");
    expect(play.nextLevelId).toBeTruthy();
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));
  });

  describe("publication checks", () => {
    let draftModuleId: string;
    let draftLessonId: string;
    let draftGameId: string;

    beforeAll(async () => {
      const created = await service.createModule(
        {
          title: "Draft only",
          subtitle: "Unpublished fixture",
          coverColor: "#334155",
        },
        teacherUser(teacher),
      );
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
    });

    async function learnerSnapshot() {
      const learner = await service.getLearner(student.learnerId);
      const progress = await database.db
        .select()
        .from(learnerProgress)
        .where(eq(learnerProgress.learnerId, student.learnerId));
      const attemptRows = await database.db
        .select()
        .from(attempts)
        .where(eq(attempts.learnerId, student.learnerId));
      return {
        hearts: learner.hearts,
        xp: learner.xp,
        progressIds: progress.map((row) => row.levelId).sort(),
        attemptCount: attemptRows.length,
        attemptLevelIds: attemptRows.map((row) => row.levelId).sort(),
      };
    }

    it("rejects reading an unpublished lesson by id without revealing content", async () => {
      await expect(
        service.getPlayLevel(draftLessonId, student.learnerId),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getModulePath(draftModuleId, student.learnerId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects completing, missing, and attempting unpublished levels without mutating progress", async () => {
      await database.db
        .update(learners)
        .set({ hearts: 5, heartsUpdatedAt: Date.now() })
        .where(eq(learners.id, student.learnerId));
      const before = await learnerSnapshot();

      await expect(
        service.completeLevel(draftLessonId, student.learnerId),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.recordMiss(draftGameId, student.learnerId, {
          idempotencyKey: "draft-miss",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.submitAttempt(draftGameId, { score: 1, maxScore: 1 }, student.learnerId),
      ).rejects.toBeInstanceOf(NotFoundException);

      const after = await learnerSnapshot();
      expect(after).toEqual(before);
    });

    it("keeps teacher preview available for unpublished levels without student mutations", async () => {
      const before = await learnerSnapshot();
      const preview = await service.getTeachLevel(draftLessonId);
      expect(preview.lesson?.markdown).toMatch(/Secret/);
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
        await expect(service.getFeaturedPath(student.learnerId)).rejects.toBeInstanceOf(
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

describe("authoritative assessment", () => {
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let alice: TestAccount;
  let bob: TestAccount;
  let teacher: TestAccount;
  let asTeacher: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-api-auth-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "assessment-spec-secret-at-least-32!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db);
    alice = await createTestAccount(database, {
      admissionEmail: "alice-assess@student.apc.edu.ph",
      displayName: "Alice",
    });
    bob = await createTestAccount(database, {
      admissionEmail: "bob-assess@student.apc.edu.ph",
      displayName: "Bob",
    });
    teacher = await createTestAccount(database, {
      admissionEmail: "studio-teacher@apc.edu.ph",
      displayName: "Studio Teacher",
      role: "teacher",
    });
    asTeacher = teacherUser(teacher);
    await service.completeLevel("ateneo-welcome", alice.learnerId);
    await service.completeLevel("ateneo-welcome", bob.learnerId);
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  async function openQuiz(learnerId: string) {
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, learnerId));
    return service.getPlayLevel("ateneo-quiz", learnerId);
  }

  it("rejects fabricated client scores on the legacy attempts route", async () => {
    await expect(
      service.submitAttempt("ateneo-quiz", { score: 999, maxScore: 1 }, alice.learnerId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps two students' scores and XP isolated", async () => {
    const alicePlay = await openQuiz(alice.learnerId);
    const bobPlay = await openQuiz(bob.learnerId);
    expect(alicePlay.attempt!.id).not.toBe(bobPlay.attempt!.id);

    const aliceChoices =
      alicePlay.game?.type === "quiz" ? alicePlay.game.questions.map(() => 0) : [];
    await service.finishAttempt(
      alicePlay.attempt!.id,
      { answers: { type: "quiz", choices: aliceChoices } },
      alice.learnerId,
    );

    const aliceAfter = await service.getLearner(alice.learnerId);
    const bobAfter = await service.getLearner(bob.learnerId);
    expect(aliceAfter.xp).toBeGreaterThan(bobAfter.xp);
    expect(bobAfter.xp).toBe(10);
  });

  it("grades from answers and still completes at zero without a pass mark", async () => {
    const play = await openQuiz(alice.learnerId);
    const quizGame = play.game;
    if (quizGame?.type !== "quiz") throw new Error("expected quiz");
    const wrongChoices = quizGame.questions.map((q) => (q.choices.length > 1 ? 1 : 0));
    const finished = await service.finishAttempt(
      play.attempt!.id,
      { answers: { type: "quiz", choices: wrongChoices } },
      alice.learnerId,
    );
    expect(finished.completed).toBe(true);
    expect(finished.score).toBeLessThanOrEqual(finished.maxScore);
  });

  it("deduplicates duplicate finish requests and clientAttemptId retries", async () => {
    const play = await openQuiz(bob.learnerId);
    const choices =
      play.game?.type === "quiz" ? play.game.questions.map(() => 0) : [];
    const clientAttemptId = randomUUID();
    const first = await service.finishAttempt(
      play.attempt!.id,
      { answers: { type: "quiz", choices }, clientAttemptId },
      bob.learnerId,
    );
    const second = await service.finishAttempt(
      play.attempt!.id,
      { answers: { type: "quiz", choices }, clientAttemptId },
      bob.learnerId,
    );
    expect(second.deduplicated).toBe(true);
    expect(second.score).toBe(first.score);
    const xp = (await service.getLearner(bob.learnerId)).xp;
    expect(xp).toBe((await service.getLearner(bob.learnerId)).xp);
  });

  it("rejects another learner's attempt id", async () => {
    const play = await openQuiz(alice.learnerId);
    await expect(
      service.finishAttempt(
        play.attempt!.id,
        { answers: { type: "quiz", choices: [0] } },
        bob.learnerId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects stale content revisions", async () => {
    const play = await openQuiz(alice.learnerId);
    const [row] = await database.db
      .select()
      .from(gameContent)
      .where(eq(gameContent.levelId, "ateneo-quiz"));
    const parsed = JSON.parse(row!.json) as {
      type: "quiz";
      questions: { prompt: string; choices: string[]; correctIndex: number }[];
    };
    parsed.questions[0] = {
      ...parsed.questions[0]!,
      prompt: `${parsed.questions[0]!.prompt} (revised)`,
    };
    await database.db
      .update(gameContent)
      .set({ json: JSON.stringify(parsed) })
      .where(eq(gameContent.levelId, "ateneo-quiz"));
    const [mod] = await database.db.select().from(modules).where(eq(modules.id, "ateneo-days"));
    if (mod?.publishedRevisionId) {
      const [revision] = await database.db
        .select()
        .from(moduleRevisions)
        .where(eq(moduleRevisions.id, mod.publishedRevisionId));
      if (revision) {
        const snapshot = JSON.parse(revision.snapshotJson) as {
          sections: Array<{ levels: Array<{ id: string; game?: unknown }> }>;
        };
        for (const section of snapshot.sections) {
          for (const level of section.levels) {
            if (level.id === "ateneo-quiz") level.game = parsed;
          }
        }
        await database.db
          .update(moduleRevisions)
          .set({ snapshotJson: JSON.stringify(snapshot) })
          .where(eq(moduleRevisions.id, revision.id));
      }
    }
    try {
      await service.finishAttempt(
        play.attempt!.id,
        { answers: { type: "quiz", choices: parsed.questions.map(() => 0) } },
        alice.learnerId,
      );
      throw new Error("expected stale revision rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
    }
  });

  it("keeps practice distinct — practice mode attempts cannot finish as assessment grades", async () => {
    const practiceId = randomUUID();
    await database.db.insert(attempts).values({
      id: practiceId,
      learnerId: alice.learnerId,
      levelId: "ateneo-quiz",
      contentRevision: "practice",
      mode: "practice",
      status: "open",
      score: 0,
      maxScore: 0,
      stars: null,
      payload: null,
      secretJson: "{}",
      eventsJson: "[]",
      createdAt: Date.now(),
      finishedAt: null,
    });
    await expect(
      service.finishAttempt(
        practiceId,
        { answers: { type: "quiz", choices: [0] } },
        alice.learnerId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not use the shared demo learner for signed-in progress", async () => {
    const demo = await service.getLearner(DEMO_LEARNER_ID).catch(() => null);
    const aliceLearner = await service.getLearner(alice.learnerId);
    expect(aliceLearner.id).not.toBe(DEMO_LEARNER_ID);
    if (demo) {
      expect(demo.xp).not.toBe(aliceLearner.xp);
    }
  });

  it("creates a wizard module with lesson+quiz and supports playtest publish path", async () => {
    const created = await service.createModuleFromWizard(
      {
        title: "Studio smoke",
        intendedLearners: "APC RIZLIFE",
        objective: "Explain one sourced claim",
        coverColor: "#22C55E",
      },
      asTeacher,
    );
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
    const mod = await service.createModule(
      {
        title: "Conflict lab",
        subtitle: "two editors",
        coverColor: "#38BDF8",
      },
      asTeacher,
    );
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
    const mod = await service.createModule(
      {
        title: "Resilient ops",
        subtitle: "mutations",
        coverColor: "#F97316",
      },
      asTeacher,
    );
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
    const mod = await service.createModuleFromWizard(
      {
        title: "Original",
        intendedLearners: "Class",
        objective: "Obj",
        coverColor: "#EF4444",
        templateId: "lesson-retrieval",
      },
      asTeacher,
    );
    const published = await service.patchModule(mod.id, {
      published: true,
      expectedRevision: (await service.getTeachModule(mod.id)).revision,
    });
    expect(published.published).toBe(true);
    const lesson = published.sections
      .flatMap((s) => s.levels)
      .find((l) => l.kind === "lesson")!;
    const copy = await service.duplicateModule(mod.id, {}, asTeacher);
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
    const mod = await service.createModule(
      {
        title: "Import lab",
        subtitle: "quiz",
        coverColor: "#FB7185",
      },
      asTeacher,
    );
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
    const mod = await service.createModule(
      {
        title: "Blocks",
        subtitle: "rich",
        coverColor: "#A855F7",
      },
      asTeacher,
    );
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
    const preview = await service.getTeachLevel(saved.id);
    expect(preview.lesson?.blocks?.some((b) => b.type === "quote")).toBe(true);
  });

  it("uploads validated assets into the module source library", async () => {
    const mod = await service.createModule(
      {
        title: "Assets",
        subtitle: "library",
        coverColor: "#22C55E",
      },
      asTeacher,
    );
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
