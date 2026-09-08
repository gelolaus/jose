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

  it("covers advanced investigation boards", () => {
    expect(labelFor("case-files")).toBe("Find the proof");
    expect(labelFor("dispatches")).toBe("Choose the next stop");
    expect(labelFor("editorial")).toBe("Build the story");
    expect(labelFor("dapitan")).toBe("Choose the best plan");
    expect(hintFor("case-files")).toMatch(/tap the evidence/i);
    expect(hintFor("dispatches")).toMatch(/tap the place that comes next/i);
    expect(hintFor("editorial")).toMatch(/claim, evidence, conclusion/i);
    expect(hintFor("dapitan")).toMatch(/helps the community/i);
  });
});
