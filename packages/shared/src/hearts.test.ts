import { describe, expect, it } from "vitest";
import {
  HEART_DRIP_MS,
  LESSON_CREDIT_MS,
  MAX_HEARTS,
  UNLIMITED_LEARNING,
  applyHeartDrip,
  applyLessonCredit,
  firstTryScore,
  nextHeartAt,
  starsFromMisses,
} from "./hearts";

describe.runIf(!UNLIMITED_LEARNING)("limited learning lives", () => {
  it("never refills Lives on a timer", () => {
    expect(applyHeartDrip(0, 0, HEART_DRIP_MS * 50)).toEqual({
      hearts: 0,
      heartsUpdatedAt: 0,
      changed: false,
    });
    expect(nextHeartAt(0, 0, 1)).toBeNull();
  });

  it("restores exactly one Life per lesson read, capped at the max", () => {
    expect(applyLessonCredit(0, 0, 100)).toEqual({
      hearts: 1,
      heartsUpdatedAt: 100,
      creditApplied: true,
    });
    expect(applyLessonCredit(MAX_HEARTS, 0, 100).creditApplied).toBe(false);
  });
});

describe("applyHeartDrip", () => {
  it("uses a ten-minute regeneration interval", () => {
    expect(HEART_DRIP_MS).toBe(10 * 60 * 1000);
    expect(LESSON_CREDIT_MS).toBe(2 * 60 * 1000);
    expect(MAX_HEARTS).toBe(5);
  });

  it("does not grant a life one millisecond before the interval", () => {
    const start = 1_000_000;
    const next = applyHeartDrip(3, start, start + HEART_DRIP_MS - 1);
    expect(next).toEqual({
      hearts: 3,
      heartsUpdatedAt: start,
      changed: false,
    });
  });

  it.runIf(UNLIMITED_LEARNING)("grants one life exactly at the interval and keeps the remainder", () => {
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

  it("caps malformed and negative values", () => {
    expect(applyHeartDrip(-2, -9, 50).hearts).toBe(0);
    expect(applyHeartDrip(99, 0, 0).hearts).toBe(5);
  });
});

describe("nextHeartAt", () => {
  it("hides the timer when lives are full", () => {
    expect(nextHeartAt(5, 10, 10_000)).toBeNull();
  });

  it.runIf(UNLIMITED_LEARNING)("points at the end of the current wait", () => {
    const start = 1_000_000;
    expect(nextHeartAt(3, start, start + 1_000)).toBe(start + HEART_DRIP_MS);
  });
});

describe("applyLessonCredit", () => {
  it.runIf(UNLIMITED_LEARNING)("shortens a full ten-minute wait to eight minutes", () => {
    const now = 5_000_000;
    const next = applyLessonCredit(3, now, now);
    expect(next.hearts).toBe(3);
    expect(next.heartsUpdatedAt).toBe(now - LESSON_CREDIT_MS);
    expect(next.creditApplied).toBe(true);
    expect(nextHeartAt(next.hearts, next.heartsUpdatedAt, now)).toBe(
      now + HEART_DRIP_MS - LESSON_CREDIT_MS,
    );
  });

  it.runIf(UNLIMITED_LEARNING)("carries one leftover minute into the next life", () => {
    const now = 5_000_000;
    const updatedAt = now - (HEART_DRIP_MS - 60_000);
    const next = applyLessonCredit(3, updatedAt, now);
    expect(next.hearts).toBe(4);
    expect(next.creditApplied).toBe(true);
    expect(nextHeartAt(next.hearts, next.heartsUpdatedAt, now)).toBe(now + 9 * 60 * 1000);
  });

  it("fills the last life and discards leftover wait", () => {
    const now = 5_000_000;
    const updatedAt = now - (HEART_DRIP_MS - 60_000);
    const next = applyLessonCredit(4, updatedAt, now);
    expect(next.hearts).toBe(5);
    expect(next.heartsUpdatedAt).toBe(now);
    expect(next.creditApplied).toBe(true);
    expect(nextHeartAt(next.hearts, next.heartsUpdatedAt, now)).toBeNull();
  });

  it("does not bank credit while already full", () => {
    const now = 5_000_000;
    const next = applyLessonCredit(5, 12, now);
    expect(next).toEqual({
      hearts: 5,
      heartsUpdatedAt: 12,
      creditApplied: false,
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
