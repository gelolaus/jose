import { describe, expect, it } from "vitest";
import { LAB_GAMES, getLabGame, isLabGameType } from "./lab-games";

describe("lab games", () => {
  it("covers all five board types", () => {
    expect(LAB_GAMES.map((entry) => entry.type).sort()).toEqual(
      ["blank", "memory", "quiz", "sort", "timeline"].sort(),
    );
  });

  it("looks up a type and rejects unknown ones", () => {
    expect(isLabGameType("timeline")).toBe(true);
    expect(isLabGameType("chess")).toBe(false);
    expect(getLabGame("sort")?.game.type).toBe("sort");
    expect(getLabGame("chess")).toBeUndefined();
  });
});
