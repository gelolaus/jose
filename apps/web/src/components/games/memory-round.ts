export const SECONDS_PER_PAIR = 8;
export const MISMATCH_PENALTY_MS = 3_000;

export function clockMs(pairCount: number): number {
  return Math.max(0, pairCount) * SECONDS_PER_PAIR * 1000;
}

export function applyMismatch(remainingMs: number): number {
  return Math.max(0, remainingMs - MISMATCH_PENALTY_MS);
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
}): "idle" | "running" | "won" | "lost" {
  if (input.pairCount > 0 && input.matchedCount >= input.pairCount) return "won";
  if (input.started && input.remainingMs <= 0) return "lost";
  if (!input.started) return "idle";
  return "running";
}
