import { describe, expect, it } from "vitest";
import { UNLIMITED_LEARNING } from "./hearts";
import {
  applyQualifyingActivity,
  calendarDayInTimeZone,
  previousCalendarDay,
  XP_RULES_COPY,
} from "./streak";

describe("calendarDayInTimeZone", () => {
  it("formats a Manila calendar day", () => {
    // 2026-09-05 16:00 UTC = 2026-09-06 00:00 Asia/Manila
    const day = calendarDayInTimeZone(Date.parse("2026-09-05T16:00:00.000Z"));
    expect(day).toBe("2026-09-06");
  });
});

describe("previousCalendarDay", () => {
  it("steps back one calendar day", () => {
    expect(previousCalendarDay("2026-09-06")).toBe("2026-09-05");
  });
});

describe("XP_RULES_COPY", () => {
  it("states first-completion XP and the replay rule that the server uses", () => {
    expect(XP_RULES_COPY).toContain("10 XP");
    expect(XP_RULES_COPY).toMatch(/practice reviews do not award path XP/i);
    if (UNLIMITED_LEARNING) {
      expect(XP_RULES_COPY).toMatch(/Replays and practice reviews do not award path XP/);
    } else {
      expect(XP_RULES_COPY).toContain("5 XP");
      expect(XP_RULES_COPY).toMatch(/passing replay/i);
    }
  });
});

describe("applyQualifyingActivity", () => {
  const noonManilaAsUtc = Date.parse("2026-09-05T04:00:00.000Z"); // Sep 5 Manila

  it("starts a streak on first activity", () => {
    expect(applyQualifyingActivity(0, null, noonManilaAsUtc)).toEqual({
      streak: 1,
      lastActivityDay: "2026-09-05",
      changed: true,
    });
  });

  it("does not double-count the same Manila day", () => {
    expect(
      applyQualifyingActivity(3, "2026-09-05", noonManilaAsUtc),
    ).toEqual({
      streak: 3,
      lastActivityDay: "2026-09-05",
      changed: false,
    });
  });

  it("increments after the previous Manila day", () => {
    const nextDay = Date.parse("2026-09-06T04:00:00.000Z");
    expect(applyQualifyingActivity(3, "2026-09-05", nextDay)).toEqual({
      streak: 4,
      lastActivityDay: "2026-09-06",
      changed: true,
    });
  });

  it("resets after a missed day", () => {
    const later = Date.parse("2026-09-08T04:00:00.000Z");
    expect(applyQualifyingActivity(3, "2026-09-05", later)).toEqual({
      streak: 1,
      lastActivityDay: "2026-09-08",
      changed: true,
    });
  });
});
