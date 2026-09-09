export const DEFAULT_SECONDS_PER_PAIR = 15;
export const DEFAULT_MISMATCH_PENALTY_MS = 0;
export const SECONDS_PER_PAIR = DEFAULT_SECONDS_PER_PAIR;
export const MISMATCH_PENALTY_MS = DEFAULT_MISMATCH_PENALTY_MS;
export function clockMs(pairCount: number): number {
  return Math.max(60_000, pairCount * DEFAULT_SECONDS_PER_PAIR * 1000);
}
export function applyMismatch(remainingMs: number): number { return Math.max(0, remainingMs); }
export function formatClock(remainingMs: number): string {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
}
export function roundPhase(input: {
  started: boolean; remainingMs: number; matchedCount: number; pairCount: number;
}): "idle" | "running" | "won" | "lost" {
  if (!input.started) return "idle";
  if (input.remainingMs <= 0) return "lost";
  if (input.pairCount > 0 && input.matchedCount >= input.pairCount) return "won";
  return "running";
}
