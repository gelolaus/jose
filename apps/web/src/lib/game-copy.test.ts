import { describe, expect, it } from "vitest";
import { hintFor, labelFor } from "./game-copy";

describe("game-copy", () => {
  it("covers classic boards", () => {
    expect(hintFor("sort")).toBe("Put every chip in a chest, then Check.");
    expect(labelFor("quiz")).toBe("Quiz");
  });

  it("covers advanced investigation boards", () => {
    expect(labelFor("case-files")).toBe("Case Files");
    expect(labelFor("dispatches")).toBe("Dispatches");
    expect(labelFor("editorial")).toBe("Editorial");
    expect(labelFor("dapitan")).toBe("Dapitan");
    expect(hintFor("dispatches")).toMatch(/list/i);
    expect(hintFor("dapitan")).toMatch(/timer/i);
  });
});
