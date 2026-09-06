import { describe, expect, it } from "vitest";
import { buildPracticeQueue, nextReviewAt } from "./practice";

describe("buildPracticeQueue", () => {
  const levelMeta = {
    "game-a": {
      moduleId: "rizal",
      moduleTitle: "Rizal",
      sectionTitle: "Education",
      title: "Quiz A",
      kind: "game" as const,
      gameType: "quiz" as const,
    },
    "game-b": {
      moduleId: "rizal",
      moduleTitle: "Rizal",
      sectionTitle: "Travels",
      title: "Memory B",
      kind: "game" as const,
      gameType: "memory" as const,
    },
  };

  it("prioritizes different recent misses for different learners", () => {
    const learnerOne = buildPracticeQueue({
      now: 1_000,
      misses: [{ levelId: "game-a", createdAt: 900 }],
      completions: [],
      reviews: [],
      levelMeta,
    });
    const learnerTwo = buildPracticeQueue({
      now: 1_000,
      misses: [{ levelId: "game-b", createdAt: 950 }],
      completions: [],
      reviews: [],
      levelMeta,
    });
    expect(learnerOne[0]?.levelId).toBe("game-a");
    expect(learnerTwo[0]?.levelId).toBe("game-b");
    expect(learnerOne[0]?.reasonKind).toBe("recent_miss");
  });
});

describe("nextReviewAt", () => {
  it("uses 1d then 3d then 7d intervals", () => {
    const t0 = 0;
    expect(nextReviewAt(0, t0)).toBe(24 * 60 * 60 * 1000);
    expect(nextReviewAt(1, t0)).toBe(3 * 24 * 60 * 60 * 1000);
    expect(nextReviewAt(5, t0)).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
