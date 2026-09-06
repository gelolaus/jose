import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MOTION, feedbackHoldMs } from "@jose/shared";

describe("motion tokens via shared package", () => {
  it("collapses feedback hold under reduced motion", () => {
    expect(feedbackHoldMs(true)).toBe(0);
    expect(feedbackHoldMs(false)).toBe(MOTION.feedbackHoldMs);
    expect(MOTION.controlMs).toBeGreaterThanOrEqual(120);
    expect(MOTION.controlMs).toBeLessThanOrEqual(180);
  });
});

describe("sound mute persistence contract", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores mute as a durable 0/1 flag", () => {
    localStorage.setItem("jose.sound.muted", "1");
    expect(localStorage.getItem("jose.sound.muted")).toBe("1");
    localStorage.setItem("jose.sound.muted", "0");
    expect(localStorage.getItem("jose.sound.muted")).toBe("0");
  });
});
