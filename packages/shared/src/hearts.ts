/**
 * Lives (internal name: hearts) refill on a ten-minute timer.
 * Required path learning and teacher assignments never spend or require lives.
 * HEARTS_EMPTY applies only to optional arcade challenge sessions.
 */
export const MAX_HEARTS = 5;
export const HEART_DRIP_MS = 10 * 60 * 1000;
export const LESSON_CREDIT_MS = 2 * 60 * 1000;
export const HEARTS_EMPTY_CODE = "HEARTS_EMPTY";

export type PlayEconomyMode = "learning" | "arcade_challenge";

export function heartsAffectPlay(mode: PlayEconomyMode): boolean {
  return mode === "arcade_challenge";
}

export function applyHeartDrip(
  hearts: number,
  heartsUpdatedAt: number,
  now: number,
): { hearts: number; heartsUpdatedAt: number; changed: boolean } {
  const capped = Math.min(MAX_HEARTS, Math.max(0, Math.floor(hearts)));
  const updatedAt = Math.max(0, heartsUpdatedAt);
  if (capped >= MAX_HEARTS) {
    return { hearts: MAX_HEARTS, heartsUpdatedAt: updatedAt, changed: false };
  }
  const elapsed = Math.max(0, now - updatedAt);
  const gained = Math.min(
    MAX_HEARTS - capped,
    Math.floor(elapsed / HEART_DRIP_MS),
  );
  if (gained <= 0) {
    return { hearts: capped, heartsUpdatedAt: updatedAt, changed: false };
  }
  return {
    hearts: capped + gained,
    heartsUpdatedAt: updatedAt + gained * HEART_DRIP_MS,
    changed: true,
  };
}

export function nextHeartAt(
  hearts: number,
  heartsUpdatedAt: number,
  now: number,
): number | null {
  const dripped = applyHeartDrip(hearts, heartsUpdatedAt, now);
  if (dripped.hearts >= MAX_HEARTS) return null;
  return dripped.heartsUpdatedAt + HEART_DRIP_MS;
}

export function applyLessonCredit(
  hearts: number,
  heartsUpdatedAt: number,
  now: number,
): { hearts: number; heartsUpdatedAt: number; creditApplied: boolean } {
  const afterDrip = applyHeartDrip(hearts, heartsUpdatedAt, now);
  if (afterDrip.hearts >= MAX_HEARTS) {
    return {
      hearts: MAX_HEARTS,
      heartsUpdatedAt: afterDrip.heartsUpdatedAt,
      creditApplied: false,
    };
  }
  const creditedAt = afterDrip.heartsUpdatedAt - LESSON_CREDIT_MS;
  const afterCredit = applyHeartDrip(afterDrip.hearts, creditedAt, now);
  if (afterCredit.hearts >= MAX_HEARTS) {
    return {
      hearts: MAX_HEARTS,
      heartsUpdatedAt: now,
      creditApplied: true,
    };
  }
  return {
    hearts: afterCredit.hearts,
    heartsUpdatedAt: afterCredit.heartsUpdatedAt,
    creditApplied: true,
  };
}

export function learnerLivesFields(
  hearts: number,
  heartsUpdatedAt: number,
  now: number,
): {
  hearts: number;
  heartsUpdatedAt: number;
  nextHeartAt: number | null;
  serverNow: number;
  dripChanged: boolean;
} {
  const dripped = applyHeartDrip(hearts, heartsUpdatedAt, now);
  return {
    hearts: dripped.hearts,
    heartsUpdatedAt: dripped.heartsUpdatedAt,
    nextHeartAt: nextHeartAt(dripped.hearts, dripped.heartsUpdatedAt, now),
    serverNow: now,
    dripChanged: dripped.changed,
  };
}

export function starsFromMisses(misses: number, pieces: number): 1 | 2 | 3 {
  if (misses <= 0) return 3;
  const allowance = Math.max(1, Math.ceil(Math.max(0, pieces) * 0.25));
  if (misses <= allowance) return 2;
  return 1;
}

export function firstTryScore(pieces: number, misses: number): {
  score: number;
  maxScore: number;
  stars: 1 | 2 | 3;
} {
  const maxScore = Math.max(0, pieces);
  const score = Math.max(0, maxScore - Math.max(0, misses));
  return { score, maxScore, stars: starsFromMisses(misses, maxScore) };
}
