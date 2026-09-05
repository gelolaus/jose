export const DEFAULT_SECONDS_PER_PAIR = 8;
export const DEFAULT_MISMATCH_PENALTY_MS = 3_000;

/** @deprecated Prefer DEFAULT_SECONDS_PER_PAIR — kept for existing imports. */
export const SECONDS_PER_PAIR = DEFAULT_SECONDS_PER_PAIR;
/** @deprecated Prefer DEFAULT_MISMATCH_PENALTY_MS. */
export const MISMATCH_PENALTY_MS = DEFAULT_MISMATCH_PENALTY_MS;

export type MemoryTiming = {
  secondsPerPair?: number;
  mismatchPenaltyMs?: number;
};

export function clockMs(
  pairCount: number,
  timing?: MemoryTiming,
): number {
  const seconds = timing?.secondsPerPair ?? DEFAULT_SECONDS_PER_PAIR;
  return Math.max(0, pairCount) * seconds * 1000;
}

export function applyMismatch(
  remainingMs: number,
  timing?: MemoryTiming,
): number {
  const penalty = timing?.mismatchPenaltyMs ?? DEFAULT_MISMATCH_PENALTY_MS;
  return Math.max(0, remainingMs - penalty);
}

export function formatClock(remainingMs: number): string {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function roundPhase(input: {
  started: boolean;
  remainingMs: number;
  matchedCount: number;
  pairCount: number;
  timed: boolean;
}): "idle" | "running" | "won" | "lost" {
  if (input.pairCount > 0 && input.matchedCount >= input.pairCount) return "won";
  if (input.timed && input.started && input.remainingMs <= 0) return "lost";
  if (!input.started) return "idle";
  return "running";
}
