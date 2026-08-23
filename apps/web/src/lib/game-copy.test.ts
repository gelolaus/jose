import { describe, expect, it } from "vitest";
import { hintFor } from "./game-copy";

describe("hintFor", () => {
  it("tells sort players to Check after placing every chip", () => {
    expect(hintFor("sort")).toBe("Put every chip in a chest, then Check.");
  });

  it("tells timeline players to Check after filling every stop", () => {
    expect(hintFor("timeline")).toBe("Put every event on its stop, then Check.");
  });
});
