/**
 * Lives (internal name: hearts). With UNLIMITED_LEARNING off, module-game
 * misses spend Lives, zero Lives blocks module games, and only reading a
 * lesson (again) restores a Life. With it on, Lives refill on a timer and
 * never block coursework.
 */

/**
 * Master switch for "unlimited learning". When true, module games never cost
 * Lives and XP is only granted on a level's first completion. When false
 * (Duolingo-style), every miss in a module game costs a Life and every won
 * module game earns XP. Practice games are never affected.
 */
export const UNLIMITED_LEARNING = false;

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
  if (!UNLIMITED_LEARNING) {
    // Lives never refill on a timer; only re-reading lessons earns them back.
    return { hearts: capped, heartsUpdatedAt: updatedAt, changed: false };
  }
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
  if (!UNLIMITED_LEARNING) return null;
  const dripped = applyHeartDrip(hearts, heartsUpdatedAt, now);
  if (dripped.hearts >= MAX_HEARTS) return null;
  return dripped.heartsUpdatedAt + HEART_DRIP_MS;
}

export function applyLessonCredit(
  hearts: number,
  heartsUpdatedAt: number,
  now: number,
): { hearts: number; heartsUpdatedAt: number; creditApplied: boolean } {
  if (!UNLIMITED_LEARNING) {
    // Each lesson read (including re-reads) restores one Life.
    const capped = Math.min(MAX_HEARTS, Math.max(0, Math.floor(hearts)));
    if (capped >= MAX_HEARTS) {
      return { hearts: MAX_HEARTS, heartsUpdatedAt, creditApplied: false };
    }
    return { hearts: capped + 1, heartsUpdatedAt: now, creditApplied: true };
  }
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

