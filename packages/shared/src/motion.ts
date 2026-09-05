/** Shared motion tokens for Jose game feel (issue #37 / ticket 35). */
export const MOTION = {
  /** Control feedback: press, select, snap — keep short so input stays snappy. */
  controlMs: 150,
  controlMsMin: 120,
  controlMsMax: 180,
  /** Screen / panel transitions. */
  screenMs: 220,
  screenMsMin: 180,
  screenMsMax: 280,
  /** Skippable milestone / celebration sequences. */
  milestoneMs: 420,
  /** Why-sheet readiness before dismiss is enabled (skipped under reduced motion). */
  feedbackHoldMs: 280,
} as const;

export type MotionCue =
  | "select"
  | "accept"
  | "reject"
  | "match"
  | "unlock"
  | "artifact"
  | "progress"
  | "milestone";

export function motionDurationMs(
  kind: "control" | "screen" | "milestone",
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0;
  switch (kind) {
    case "control":
      return MOTION.controlMs;
    case "screen":
      return MOTION.screenMs;
    case "milestone":
      return MOTION.milestoneMs;
  }
}

export function feedbackHoldMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : MOTION.feedbackHoldMs;
}
