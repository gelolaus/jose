import { describe, expect, it } from "vitest";
import { hintFor, labelFor } from "./game-copy";

describe("hintFor", () => {
  it("tells sort players to Check after placing evidence", () => {
    expect(hintFor("sort")).toContain("Check");
  });

  it("tells timeline players to explain the connection", () => {
    expect(hintFor("timeline")).toContain("connection");
  });

  it("tells memory players the learning mode is untimed", () => {
    expect(hintFor("memory")).toContain("no timer");
  });
});

describe("labelFor", () => {
  it("uses the upgraded activity names", () => {
    expect(labelFor("quiz")).toBe("Evidence duel");
    expect(labelFor("memory")).toBe("Archive match");
    expect(labelFor("blank")).toBe("Restore the passage");
  });
});
