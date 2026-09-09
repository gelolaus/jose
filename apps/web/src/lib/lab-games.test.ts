import { describe, expect, it } from "vitest";
import { LAB_GAMES, getLabGame, isLabGameType } from "./lab-games";

describe("lab games", () => {
  it("offers only the five simple games", () => {
    expect(LAB_GAMES.map((entry) => entry.type)).toEqual(["timeline", "quiz", "memory", "sort", "blank"]);
    for (const type of ["case-files", "dispatches", "editorial", "dapitan"]) {
      expect(isLabGameType(type)).toBe(false);
      expect(getLabGame(type)).toBeUndefined();
    }
  });

  it("looks up a type and rejects unknown ones", () => {
    expect(isLabGameType("timeline")).toBe(true);
    expect(isLabGameType("chess")).toBe(false);
    expect(getLabGame("sort")?.game.type).toBe("sort");
    expect(getLabGame("chess")).toBeUndefined();
  });
});
