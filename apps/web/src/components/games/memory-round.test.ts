import { describe, expect, it } from "vitest";
import { applyMismatch, clockMs, formatClock, roundPhase } from "./memory-round";
describe("matching clock", () => {
  it("allows 15 seconds per pair with a one-minute minimum", () => {
    expect(clockMs(2)).toBe(60_000);
    expect(clockMs(4)).toBe(60_000);
    expect(clockMs(8)).toBe(120_000);
  });
  it("never deducts time for a mismatch", () => expect(applyMismatch(32_000)).toBe(32_000));
  it("formats time", () => expect(formatClock(60_001)).toBe("1:01"));
  it("cannot win at or beyond its deadline", () => {
    expect(roundPhase({ started: true, remainingMs: 0, matchedCount: 2, pairCount: 2 })).toBe("lost");
  });
});
