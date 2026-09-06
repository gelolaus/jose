import { describe, expect, it } from "vitest";
import { heartsAffectPlay } from "./hearts";

describe("heartsAffectPlay", () => {
  it("never gates core learning", () => {
    expect(heartsAffectPlay("learning")).toBe(false);
    expect(heartsAffectPlay("arcade_challenge")).toBe(true);
  });
});
