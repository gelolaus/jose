import { describe, expect, it } from "vitest";
import { hasSessionReward, readSessionReward } from "./session-reward";
import { openingProgress } from "./session-progress";

describe("readSessionReward", () => {
  it("skips a completion payload that has none of the reward fields", () => {
    const reward = readSessionReward({ learner: { streak: 2 }, completed: true });
    expect(reward).toEqual({ badgeTitle: null, xp: null, streak: null });
    expect(hasSessionReward(reward)).toBe(false);
  });

  it("reads a badge title, positive XP, and a streak increase from a cast payload", () => {
    const reward = readSessionReward({
      moduleBadge: { title: "  Noli  " },
      xpAwarded: 10,
      streakIncreased: true,
      learner: { streak: 3 },
    });
    expect(reward).toEqual({ badgeTitle: "Noli", xp: 10, streak: 3 });
    expect(hasSessionReward(reward)).toBe(true);
  });

  it("ignores an empty badge, non-positive XP, and a replay that did not increase the streak", () => {
    const reward = readSessionReward({
      moduleBadge: { title: "   " },
      xpAwarded: 0,
      streakIncreased: false,
      learner: { streak: 3 },
    });
    expect(hasSessionReward(reward)).toBe(false);
  });
});

describe("openingProgress", () => {
  it("starts quiz, sort, and memory bars at the first step", () => {
    expect(openingProgress({ type: "quiz", questions: [{}, {}, {}, {}, {}] })).toEqual({
      label: "Question 1 of 5",
      value: 0,
      max: 5,
    });
    expect(openingProgress({ type: "sort", items: [{}, {}] })).toEqual({
      label: "0 of 2 cards placed",
      value: 0,
      max: 2,
    });
    expect(openingProgress({ type: "memory", pairCount: 4 })).toEqual({
      label: "0 of 4 pairs matched",
      value: 0,
      max: 4,
    });
  });
});