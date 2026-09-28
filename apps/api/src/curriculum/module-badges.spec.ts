import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import {
  attemptResultSchema,
  finishAttemptResultSchema,
  profileStatsResponseSchema,
  type SessionUser,
} from "@jose/shared";
import { AppModule } from "../app.module";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { DatabaseService } from "../db/database.service";
import { backfillLearnerModuleBadges } from "../db/migrations";
import { applyPendingSeeds } from "../db/seed";
import {
  learnerAchievements,
  learnerModuleBadges,
  learnerProgress,
  moduleRevisions,
} from "../db/schema";
import { CurriculumService } from "./curriculum.service";

function asUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

const LESSON = "## Published lesson\n\nStudents read this exact wording on the path.";

describe("learner module badges", () => {
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let student: TestAccount;
  let other: TestAccount;
  let teacher: TestAccount;
  let teacherUser: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-badges-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "module-badges-spec-secret-at-least-32";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    student = await createTestAccount(database, {
      admissionEmail: "badge.student@student.apc.edu.ph",
      displayName: "Badge Student",
    });
    other = await createTestAccount(database, {
      admissionEmail: "badge.other@student.apc.edu.ph",
      displayName: "Other Student",
    });
    teacher = await createTestAccount(database, {
      admissionEmail: "badge.teacher@apc.edu.ph",
      displayName: "Badge Teacher",
      role: "teacher",
    });
    teacherUser = asUser(teacher);
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

  async function publishLesson(title: string, subtitle = "A published path") {
    const created = await service.createModule(
      { title, subtitle, coverColor: "#38BDF8" },
      teacherUser,
    );
    const lesson = await service.createLevel(created.sections[0]!.id, {
      title: "Read",
      kind: "lesson",
    });
    await service.putLesson(lesson.id, { markdown: LESSON });
    await service.patchModule(
      created.id,
      { objectives: "Read the published lesson before the badge is awarded.", authorReviewed: true },
      teacherUser,
    );
    const published = await service.publishModule(
      created.id,
      { authorReviewed: true, note: "v1" },
      teacherUser,
    );
    return { created, lesson, published };
  }

  async function badgeRows(learnerId: string, moduleId?: string) {
    return database.db
      .select()
      .from(learnerModuleBadges)
      .where(
        moduleId
          ? and(
              eq(learnerModuleBadges.learnerId, learnerId),
              eq(learnerModuleBadges.moduleId, moduleId),
            )
          : eq(learnerModuleBadges.learnerId, learnerId),
      );
  }

  it("awards one badge on the first finish and returns it", async () => {
    const { created, lesson } = await publishLesson("First Shelf");
    const before = await service.getLearner(student.learnerId);
    const result = attemptResultSchema.parse(
      await service.completeLevel(lesson.id, student.learnerId),
    );
    expect(result.firstTime).toBe(true);
    expect(result.xpAwarded).toBe(10);
    expect(result.streakIncreased).toBe(true);
    expect(result.moduleBadge).toMatchObject({
      moduleId: created.id,
      title: "First Shelf",
      subtitle: "A published path",
      coverColor: "#38BDF8",
      levelCount: 1,
      publishedRevisionId: result.contentRevisionId,
      stillPublished: true,
    });
    expect(result.learner.xp).toBe(before.xp + 10);
    expect(result.learner.dailyGoal).toEqual({
      met: true,
      completedLevelsToday: 1,
      targetLevels: 1,
    });

    const rows = await badgeRows(student.learnerId, created.id);
    expect(rows).toHaveLength(1);
    const stats = profileStatsResponseSchema.parse(
      await service.getProfileStats(student.learnerId),
    );
    expect(stats.badges.filter((badge) => badge.moduleId === created.id)).toEqual([
      expect.objectContaining({
        title: "First Shelf",
        earnedAt: rows[0]!.earnedAt,
        stillPublished: true,
      }),
    ]);
    const summary = stats.modules.find((module) => module.moduleId === created.id);
    expect(summary).toMatchObject({ completedCount: 1, totalCount: 1 });
  });

  it("does not change earned_at when the level is replayed", async () => {
    const { created, lesson } = await publishLesson("Replay Shelf");
    const first = attemptResultSchema.parse(
      await service.completeLevel(lesson.id, student.learnerId),
    );
    const earnedAt = first.moduleBadge?.earnedAt;
    const xp = (await service.getLearner(student.learnerId)).xp;
    const replay = attemptResultSchema.parse(
      await service.completeLevel(lesson.id, student.learnerId),
    );
    expect(replay.moduleBadge).toBeNull();
    expect(replay.xpAwarded).toBe(0);
    expect(replay.streakIncreased).toBe(false);
    expect(replay.firstTime).toBe(false);
    expect((await service.getLearner(student.learnerId)).xp).toBe(xp);
    const rows = await badgeRows(student.learnerId, created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.earnedAt).toBe(earnedAt);
    expect(rows[0]!.titleSnapshot).toBe("Replay Shelf");
  });

  it("keeps the original badge when a new revision adds a level", async () => {
    const { created, lesson, published } = await publishLesson("Revision Shelf");
    const first = attemptResultSchema.parse(
      await service.completeLevel(lesson.id, student.learnerId),
    );
    const earnedAt = first.moduleBadge?.earnedAt;
    const extra = await service.createLevel(created.sections[0]!.id, {
      title: "Draft only",
      kind: "lesson",
    });
    const beforeRepublish = profileStatsResponseSchema.parse(
      await service.getProfileStats(student.learnerId),
    );
    expect(
      beforeRepublish.modules.find((module) => module.moduleId === created.id),
    ).toMatchObject({ completedCount: 1, totalCount: 1 });

    await service.putLesson(extra.id, { markdown: LESSON });
    await service.putLesson(lesson.id, {
      markdown: "## Draft correction\n\nThis wording is not the badge snapshot.",
    });
    await service.patchModule(created.id, { title: "Revision Shelf Renamed" }, teacherUser);
    const courseEarnedAt = 1_600_000_000_000;
    await database.db
      .insert(learnerAchievements)
      .values({
        learnerId: student.learnerId,
        achievementId: "course-complete",
        earnedAt: courseEarnedAt,
      })
      .onConflictDoNothing();
    await service.publishModule(created.id, { authorReviewed: true, note: "v2" }, teacherUser);

    const rows = await badgeRows(student.learnerId, created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.earnedAt).toBe(earnedAt);
    expect(rows[0]!.titleSnapshot).toBe("Revision Shelf");
    expect(rows[0]!.publishedRevisionId).toBe(published.revision.id);
    const stats = profileStatsResponseSchema.parse(
      await service.getProfileStats(student.learnerId),
    );
    expect(stats.badges.find((badge) => badge.moduleId === created.id)).toMatchObject({
      title: "Revision Shelf",
      stillPublished: true,
      earnedAt,
    });
    expect(stats.modules.find((module) => module.moduleId === created.id)).toMatchObject({
      completedCount: 1,
      totalCount: 2,
      title: "Revision Shelf Renamed",
    });
    const course = stats.achievements.find((item) => item.id === "course-complete");
    expect(course?.unlocked).toBe(true);
    expect(course?.earnedAt).toBe(courseEarnedAt);
    const stored = await database.db
      .select()
      .from(learnerAchievements)
      .where(
        and(
          eq(learnerAchievements.learnerId, student.learnerId),
          eq(learnerAchievements.achievementId, "course-complete"),
        ),
      );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.earnedAt).toBe(courseEarnedAt);
  });

  it("leaves the badge in place when the module is unpublished", async () => {
    const { created, lesson } = await publishLesson("Unpublish Shelf");
    await service.completeLevel(lesson.id, student.learnerId);
    await service.unpublishModule(created.id, teacherUser);
    const rows = await badgeRows(student.learnerId, created.id);
    expect(rows).toHaveLength(1);
    const stats = profileStatsResponseSchema.parse(
      await service.getProfileStats(student.learnerId),
    );
    expect(stats.badges.find((badge) => badge.moduleId === created.id)?.stillPublished).toBe(
      false,
    );
    expect(stats.modules.some((module) => module.moduleId === created.id)).toBe(false);
  });

  it("does not give the badge to a second learner", async () => {
    const { created, lesson } = await publishLesson("Private Shelf");
    await service.completeLevel(lesson.id, student.learnerId);
    const stats = profileStatsResponseSchema.parse(
      await service.getProfileStats(other.learnerId),
    );
    expect(stats.badges.some((badge) => badge.moduleId === created.id)).toBe(false);
    expect(await badgeRows(other.learnerId, created.id)).toHaveLength(0);
  });

  it("awards 10 XP on the first passing game and 5 on a passing replay", async () => {
    const created = await service.createModule(
      { title: "Quiz Shelf", subtitle: "Games", coverColor: "#F97316" },
      teacherUser,
    );
    const quiz = await service.createLevel(created.sections[0]!.id, {
      title: "Check",
      kind: "game",
      gameType: "quiz",
    });
    await service.putGame(quiz.id, {
      type: "quiz",
      questions: [
        {
          prompt: "Where was Rizal born?",
          choices: ["Calamba", "Manila"],
          correctIndex: 0,
          why: "Calamba, Laguna.",
        },
      ],
    });
    await service.patchModule(
      created.id,
      { objectives: "Answer one published quiz about Rizal.", authorReviewed: true },
      teacherUser,
    );
    await service.publishModule(created.id, { authorReviewed: true }, teacherUser);

    const before = (await service.getLearner(student.learnerId)).xp;
    const play = await service.getPlayLevel(quiz.id, student.learnerId);
    const first = finishAttemptResultSchema.parse(
      await service.finishAttempt(
        play.attempt!.id,
        { answers: { type: "quiz", choices: [0] } },
        student.learnerId,
      ),
    );
    expect(first.xpAwarded).toBe(10);
    expect(first.moduleBadge?.moduleId).toBe(created.id);
    expect(first.learner.xp).toBe(before + 10);

    const replayPlay = await service.getPlayLevel(quiz.id, student.learnerId);
    const replay = finishAttemptResultSchema.parse(
      await service.finishAttempt(
        replayPlay.attempt!.id,
        { answers: { type: "quiz", choices: [0] } },
        student.learnerId,
      ),
    );
    expect(replay.moduleBadge).toBeNull();
    expect(replay.xpAwarded).toBe(5);
    expect(replay.streakIncreased).toBe(false);
    expect(replay.learner.xp).toBe(before + 15);
    const rows = await badgeRows(student.learnerId, created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.earnedAt).toBe(first.moduleBadge?.earnedAt);

    const practiced = await service.submitPracticeAttempt(student.learnerId, {
      levelId: quiz.id,
      score: 1,
      maxScore: 1,
    });
    expect(practiced.marksAssignmentComplete).toBe(false);
    expect((await service.getLearner(student.learnerId)).xp).toBe(before + 15);
  });

  it("does not award a badge for a published snapshot with no levels", async () => {
    const { created, lesson, published } = await publishLesson("Empty Shelf");
    const [revision] = await database.db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, published.revision.id));
    const snapshot = JSON.parse(revision!.snapshotJson) as {
      sections: Array<{ levels: unknown[] }>;
    };
    snapshot.sections = snapshot.sections.map((section) => ({ ...section, levels: [] }));
    await database.db
      .update(moduleRevisions)
      .set({ snapshotJson: JSON.stringify(snapshot) })
      .where(eq(moduleRevisions.id, published.revision.id));

    const result = attemptResultSchema.parse(
      await service.completeLevel(lesson.id, student.learnerId),
    );
    expect(result.moduleBadge).toBeNull();
    expect(await badgeRows(student.learnerId, created.id)).toHaveLength(0);
    await backfillLearnerModuleBadges(database.client);
    expect(await badgeRows(student.learnerId, created.id)).toHaveLength(0);
  });

  it("backfills a fully completed historical revision and skips a partial one", async () => {
    const full = await publishLesson("History Shelf", "Original subtitle");
    const completedAt = 1_700_000_000_000;
    await database.db.insert(learnerProgress).values({
      learnerId: other.learnerId,
      levelId: full.lesson.id,
      completedAt,
      publishedRevisionId: full.published.revision.id,
    });
    const added = await service.createLevel(full.created.sections[0]!.id, {
      title: "Added later",
      kind: "lesson",
    });
    await service.putLesson(added.id, { markdown: LESSON });
    await service.patchModule(full.created.id, { title: "History Shelf Revised" }, teacherUser);
    await service.publishModule(
      full.created.id,
      { authorReviewed: true, note: "v2" },
      teacherUser,
    );
    expect(await badgeRows(other.learnerId, full.created.id)).toHaveLength(0);

    const partial = await service.createModule(
      { title: "Partial History", subtitle: "Missing a level", coverColor: "#22C55E" },
      teacherUser,
    );
    const done = await service.createLevel(partial.sections[0]!.id, {
      title: "Done",
      kind: "lesson",
    });
    const missing = await service.createLevel(partial.sections[0]!.id, {
      title: "Missing",
      kind: "lesson",
    });
    await service.putLesson(done.id, { markdown: LESSON });
    await service.putLesson(missing.id, { markdown: LESSON });
    await service.patchModule(
      partial.id,
      { objectives: "Two levels, only one of which was finished.", authorReviewed: true },
      teacherUser,
    );
    await service.publishModule(partial.id, { authorReviewed: true }, teacherUser);
    await database.db.insert(learnerProgress).values({
      learnerId: other.learnerId,
      levelId: done.id,
      completedAt: completedAt + 50,
      publishedRevisionId: null,
    });

    await backfillLearnerModuleBadges(database.client);

    const awarded = await badgeRows(other.learnerId, full.created.id);
    expect(awarded).toHaveLength(1);
    expect(awarded[0]).toMatchObject({
      titleSnapshot: "History Shelf",
      subtitleSnapshot: "Original subtitle",
      coverColorSnapshot: "#38BDF8",
      publishedRevisionId: full.published.revision.id,
      levelCount: 1,
      earnedAt: completedAt,
    });
    expect(await badgeRows(other.learnerId, partial.id)).toHaveLength(0);

    await backfillLearnerModuleBadges(database.client);
    const again = await badgeRows(other.learnerId, full.created.id);
    expect(again).toHaveLength(1);
    expect(again[0]!.earnedAt).toBe(completedAt);
    expect(again[0]!.titleSnapshot).toBe("History Shelf");
  });
});
