import { describe, expect, it } from "vitest";
import { deriveLevelStatuses, isLevelLocked } from "./progress";

describe("deriveLevelStatuses", () => {
  const ids = ["a", "b", "c"];

  it("marks the first incomplete level current", () => {
    expect(deriveLevelStatuses(ids, new Set(["a"]))).toEqual({
      a: "completed",
      b: "current",
      c: "locked",
    });
  });

  it("opens the first level when nothing is complete", () => {
    expect(deriveLevelStatuses(ids, new Set())).toEqual({
      a: "current",
      b: "locked",
      c: "locked",
    });
  });

  it("treats a fully complete path as all completed", () => {
    expect(deriveLevelStatuses(ids, new Set(ids))).toEqual({
      a: "completed",
      b: "completed",
      c: "completed",
    });
  });
});

describe("isLevelLocked", () => {
  it("locks levels after the current one", () => {
    expect(isLevelLocked(["a", "b"], new Set(), "b")).toBe(true);
    expect(isLevelLocked(["a", "b"], new Set(), "a")).toBe(false);
  });
});
