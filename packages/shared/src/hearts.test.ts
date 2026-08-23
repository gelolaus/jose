import { describe, expect, it } from "vitest";
import {
  HEART_DRIP_MS,
  applyHeartDrip,
  firstTryScore,
  starsFromMisses,
} from "./hearts";

describe("applyHeartDrip", () => {
  it("adds one heart per 15 minutes and keeps the remainder", () => {
    const start = 1_000_000;
    const next = applyHeartDrip(3, start, start + HEART_DRIP_MS * 2 + 1_000);
    expect(next).toEqual({
      hearts: 5,
      heartsUpdatedAt: start + HEART_DRIP_MS * 2,
      changed: true,
    });
  });

  it("does nothing when already full", () => {
    expect(applyHeartDrip(5, 10, 10 + HEART_DRIP_MS * 8)).toEqual({
      hearts: 5,
      heartsUpdatedAt: 10,
      changed: false,
    });
  });
});

describe("starsFromMisses", () => {
  it("gives three stars for a clean round", () => {
    expect(starsFromMisses(0, 4)).toBe(3);
  });

  it("gives two stars for a small miss count", () => {
    expect(starsFromMisses(1, 4)).toBe(2);
  });

  it("gives one star when misses pile up", () => {
    expect(starsFromMisses(4, 4)).toBe(1);
  });
});

describe("firstTryScore", () => {
  it("subtracts misses from the piece count", () => {
    expect(firstTryScore(4, 1)).toEqual({ score: 3, maxScore: 4, stars: 2 });
  });
});
