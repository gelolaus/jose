import { describe, expect, it } from "vitest";
import { deriveAchievements } from "./profile-stats";

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
