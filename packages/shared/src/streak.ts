/** APC default calendar for qualifying learning activity. */
export const LEARNING_TIMEZONE = "Asia/Manila";

export function calendarDayInTimeZone(
  epochMs: number,
  timeZone: string = LEARNING_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not format calendar day");
  }
  return `${year}-${month}-${day}`;
}

/** Previous calendar day string (YYYY-MM-DD) in the given timezone. */
export function previousCalendarDay(
  day: string,
  timeZone: string = LEARNING_TIMEZONE,
): string {
  const noonUtc = Date.parse(`${day}T12:00:00.000Z`);
  // Step back ~36h then re-format in zone to avoid DST edge surprises.
  const prior = noonUtc - 36 * 60 * 60 * 1000;
  let cursor = prior;
  for (let i = 0; i < 4; i++) {
    const candidate = calendarDayInTimeZone(cursor, timeZone);
    if (candidate < day) return candidate;
    cursor -= 12 * 60 * 60 * 1000;
  }
  throw new Error(`Could not find previous day for ${day}`);
}

export type StreakUpdate = {
  streak: number;
  lastActivityDay: string;
  changed: boolean;
};

/**
 * Qualifying activity updates streak once per Manila calendar day.
 * Same-day replays do not increment. Missing a day resets to 1.
 */
export function applyQualifyingActivity(
  currentStreak: number,
  lastActivityDay: string | null,
  nowMs: number,
  timeZone: string = LEARNING_TIMEZONE,
): StreakUpdate {
  const today = calendarDayInTimeZone(nowMs, timeZone);
  if (lastActivityDay === today) {
    return {
      streak: Math.max(0, currentStreak),
      lastActivityDay: today,
      changed: false,
    };
  }
  const yesterday = previousCalendarDay(today, timeZone);
  if (lastActivityDay === yesterday) {
    return {
      streak: Math.max(1, currentStreak) + 1,
      lastActivityDay: today,
      changed: true,
    };
  }
  return { streak: 1, lastActivityDay: today, changed: true };
}

export const STREAK_RULES_COPY =
  "A day of streak counts when you complete a lesson, game, or practice review in Asia/Manila time. Replaying the same day does not add extra streak. Missing a Manila calendar day resets the count to 1 on your next activity.";

export const XP_RULES_COPY =
  "You earn 10 XP the first time you complete each path level. Replays and practice reviews do not award path XP and do not mark formal assignments complete.";
