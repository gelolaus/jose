import { Test, type TestingModule } from "@nestjs/testing";
import { HttpException, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  DEMO_LEARNER_ID,
  HEARTS_EMPTY_CODE,
  modulesResponseSchema,
  pathResponseSchema,
  type SessionUser,
} from "@jose/shared";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { attempts, gameContent, learnerProgress, learners, modules } from "../db/schema";
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

  it("refuses to delete the featured module", async () => {
    await expect(service.deleteModule("rizal")).rejects.toThrow(/cannot be deleted/i);
  });

  it("spends a heart on a miss and refills after a lesson", async () => {
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
    expect(afterMiss.hearts).toBe(before.hearts - 1);

    await database.db
      .update(learners)
      .set({ hearts: 1, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));
    await service.completeLevel("edu-binan", student.learnerId);
    expect((await service.getLearner(student.learnerId)).hearts).toBe(5);
  });

  it("blocks starting a game at zero hearts", async () => {
    await service.completeLevel("ateneo-welcome", student.learnerId);
    await database.db
      .update(learners)
      .set({ hearts: 0, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));
    try {
      await service.getPlayLevel("ateneo-quiz", student.learnerId);
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
});
