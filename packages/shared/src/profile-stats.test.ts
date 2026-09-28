import { describe, expect, it } from "vitest";
import { attemptResultSchema } from "./modules";
import { finishAttemptResultSchema } from "./assessment";
import { deriveAchievements, profileStatsResponseSchema } from "./profile-stats";

describe("deriveAchievements", () => {
  it("keeps on-the-path after the course is finished", () => {
    const achievements = deriveAchievements({
      hasAnyProgress: true,
      chestsOpened: 2,
      anyChapterFullyComplete: true,
      allPublishedComplete: true,
      previouslyEarned: new Set(["on-the-path", "first-treasure"]),
    });
    const onPath = achievements.find((a) => a.id === "on-the-path");
    expect(onPath?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === "course-complete")?.unlocked).toBe(
      true,
    );
  });

  it("does not unlock without evidence or prior earn", () => {
    const achievements = deriveAchievements({
      hasAnyProgress: false,
      chestsOpened: 0,
      anyChapterFullyComplete: false,
      allPublishedComplete: false,
      previouslyEarned: new Set(),
    });
    expect(achievements.every((a) => !a.unlocked)).toBe(true);
  });
});

const learner = {
  id: "u",
  displayName: "A",
  streak: 0,
  hearts: 5,
  xp: 0,
};

describe("profileStatsResponseSchema", () => {
  it("defaults badges to an empty array when an older payload omits them", () => {
    const parsed = profileStatsResponseSchema.parse({
      learner,
      modules: [],
      totals: { completedLevels: 0, totalLevels: 0, chestsOpened: 0 },
      achievements: [],
      rules: { xp: "x", streak: "s", hearts: "h" },
    });
    expect(parsed.badges).toEqual([]);
    expect(parsed.learner.dailyGoal).toBeUndefined();
  });

  it("keeps a badge and an optional daily goal", () => {
    const parsed = profileStatsResponseSchema.parse({
      learner: {
        ...learner,
        dailyGoal: { met: true, completedLevelsToday: 1, targetLevels: 1 },
      },
      modules: [],
      totals: { completedLevels: 1, totalLevels: 1, chestsOpened: 0 },
      achievements: [],
      badges: [
        {
          moduleId: "mod",
          title: "Rizal",
          subtitle: "Law",
          coverColor: "#112233",
          levelCount: 2,
          earnedAt: 10,
          publishedRevisionId: null,
          stillPublished: false,
        },
      ],
      rules: { xp: "x", streak: "s", hearts: "h" },
    });
    expect(parsed.badges[0]?.title).toBe("Rizal");
    expect(parsed.badges[0]?.stillPublished).toBe(false);
    expect(parsed.learner.dailyGoal).toEqual({
      met: true,
      completedLevelsToday: 1,
      targetLevels: 1,
    });
  });
});

describe("completion payload fields", () => {
  it("parses lesson results when the new fields are missing or null", () => {
    const bare = attemptResultSchema.parse({
      completed: true,
      firstTime: true,
      learner,
    });
    expect(bare.moduleBadge).toBeUndefined();
    expect(bare.xpAwarded).toBeUndefined();
    expect(bare.streakIncreased).toBeUndefined();
    const withNull = attemptResultSchema.parse({
      completed: true,
      firstTime: false,
      learner,
      moduleBadge: null,
      xpAwarded: 0,
      streakIncreased: false,
    });
    expect(withNull.moduleBadge).toBeNull();
    expect(withNull.xpAwarded).toBe(0);
  });

  it("parses game finishes when the new fields are missing or null", () => {
    const base = {
      attemptId: "attempt",
      mode: "assessment" as const,
      completed: true,
      firstTime: true,
      score: 1,
      maxScore: 1,
      stars: 1 as const,
      learner,
      deduplicated: false,
    };
    expect(finishAttemptResultSchema.parse(base).moduleBadge).toBeUndefined();
    expect(
      finishAttemptResultSchema.parse({
        ...base,
        moduleBadge: null,
        xpAwarded: 5,
        streakIncreased: false,
      }).xpAwarded,
    ).toBe(5);
  });
});
