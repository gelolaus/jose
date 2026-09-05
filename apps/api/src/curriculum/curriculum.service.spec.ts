import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  modulesResponseSchema,
  pathResponseSchema,
  HEARTS_EMPTY_CODE,
  DEMO_LEARNER_ID,
} from "@jose/shared";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { eq } from "drizzle-orm";
import { attempts, gameContent, learners } from "../db/schema";
import { BadRequestException, ForbiddenException, HttpException } from "@nestjs/common";

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
    expect(play.attempt?.mode).toBe("assessment");
    expect(play.attempt?.id).toBeTruthy();
    expect(JSON.stringify(play.game)).not.toMatch(/correctIndex/);
    expect(JSON.stringify(play.game)).not.toMatch(/"why"/);
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
});

describe("CurriculumService authoritative assessment (rec 05)", () => {
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-api-auth-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await service.completeLevel("ateneo-welcome");
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

  async function openQuiz() {
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, DEMO_LEARNER_ID));
    return service.getPlayLevel("ateneo-quiz");
  }

  it("rejects fabricated client scores on the legacy attempts route", async () => {
    await expect(
      service.submitAttempt("ateneo-quiz", { score: 999, maxScore: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("grades from answers and still completes at zero without a pass mark", async () => {
    const play = await openQuiz();
    const attemptId = play.attempt!.id;
    const quizGame = play.game;
    expect(quizGame?.type).toBe("quiz");
    if (quizGame?.type !== "quiz") throw new Error("expected quiz");
    const questionCount = quizGame.questions.length;
    expect(questionCount).toBeGreaterThan(0);

    // Wrong-ish answers for every question; completion still granted at any score.
    const wrongChoices = quizGame.questions.map((q) => (q.choices.length > 1 ? 1 : 0));
    const finished = await service.finishAttempt(attemptId, {
      answers: { type: "quiz", choices: wrongChoices },
    });
    expect(finished.mode).toBe("assessment");
    expect(finished.maxScore).toBe(questionCount);
    expect(finished.score).toBeLessThanOrEqual(finished.maxScore);
    expect(finished.completed).toBe(true);
    expect(finished.deduplicated).toBe(false);
  });

  it("deduplicates duplicate finish requests", async () => {
    const play = await openQuiz();
    const attemptId = play.attempt!.id;
    const choices =
      play.game?.type === "quiz"
        ? play.game.questions.map(() => 0)
        : [];
    const first = await service.finishAttempt(attemptId, {
      answers: { type: "quiz", choices },
    });
    const second = await service.finishAttempt(attemptId, {
      answers: { type: "quiz", choices },
    });
    expect(second.deduplicated).toBe(true);
    expect(second.score).toBe(first.score);
    expect(second.maxScore).toBe(first.maxScore);
    expect(second.attemptId).toBe(first.attemptId);
  });

  it("rejects another learner's attempt id", async () => {
    const otherId = "other-learner";
    await database.db.insert(learners).values({
      id: otherId,
      displayName: "Other",
      streak: 0,
      hearts: 5,
      heartsUpdatedAt: Date.now(),
      xp: 0,
    });
    const foreignAttempt = randomUUID();
    await database.db.insert(attempts).values({
      id: foreignAttempt,
      learnerId: otherId,
      levelId: "ateneo-quiz",
      contentRevision: "rev",
      mode: "assessment",
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
      service.finishAttempt(foreignAttempt, {
        answers: { type: "quiz", choices: [0] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.evaluateAttempt(foreignAttempt, {
        type: "quiz_choice",
        questionIndex: 0,
        choiceIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects stale content revisions", async () => {
    const play = await openQuiz();
    const attemptId = play.attempt!.id;
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
      await service.finishAttempt(attemptId, {
        answers: {
          type: "quiz",
          choices: parsed.questions.map(() => 0),
        },
      });
      throw new Error("expected stale revision rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: "STALE_CONTENT_REVISION",
      });
    }
  });

  it("keeps practice distinct — practice mode attempts cannot finish as assessment grades", async () => {
    const practiceId = randomUUID();
    await database.db.insert(attempts).values({
      id: practiceId,
      learnerId: DEMO_LEARNER_ID,
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
      service.finishAttempt(practiceId, {
        answers: { type: "quiz", choices: [0] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
