export const MAX_HEARTS = 5;
export const HEART_DRIP_MS = 15 * 60 * 1000;
export const HEARTS_EMPTY_CODE = "HEARTS_EMPTY";

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
