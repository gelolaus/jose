import { describe, expect, it } from "vitest";
import {
  applyMismatch,
  clockMs,
  formatClock,
  roundPhase,
} from "./memory-round";

describe("clockMs", () => {
  it("gives 8 seconds per pair", () => {
    expect(clockMs(2)).toBe(16_000);
    expect(clockMs(4)).toBe(32_000);
    expect(clockMs(8)).toBe(64_000);
  });
});

describe("applyMismatch", () => {
  it("subtracts 3 seconds and floors at zero", () => {
    expect(applyMismatch(32_000)).toBe(29_000);
    expect(applyMismatch(2_000)).toBe(0);
    expect(applyMismatch(0)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats remaining time as m:ss", () => {
    expect(formatClock(32_000)).toBe("0:32");
    expect(formatClock(64_000)).toBe("1:04");
    expect(formatClock(500)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
  });
});

describe("roundPhase", () => {
  it("stays idle until the first flip", () => {
    expect(
      roundPhase({ started: false, remainingMs: 32_000, matchedCount: 0, pairCount: 4 }),
    ).toBe("idle");
  });

  it("is running after the first flip while time remains", () => {
    expect(
      roundPhase({ started: true, remainingMs: 12_000, matchedCount: 1, pairCount: 4 }),
    ).toBe("running");
  });

  it("wins when every pair is matched, even at 0:00", () => {
    expect(
      roundPhase({ started: true, remainingMs: 0, matchedCount: 4, pairCount: 4 }),
    ).toBe("won");
  });

  it("loses when time hits zero before the board is clear", () => {
    expect(
      roundPhase({ started: true, remainingMs: 0, matchedCount: 3, pairCount: 4 }),
    ).toBe("lost");
  });
});
