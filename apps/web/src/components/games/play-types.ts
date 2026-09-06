import type { AttemptEvent, EvaluateEventResult, FinishAnswers } from "@jose/shared";

export type WhyPayload = {
  title: string;
  body: string;
  tone?: "miss" | "explain" | "success";
  sourceLabel?: string;
  sourceHref?: string;
};

export type MissOpts = {
  hold?: boolean;
};

export type PlayBoardProps = {
  disabled: boolean;
  onMiss: (
    why: WhyPayload | null,
    opts?: MissOpts,
  ) => Promise<"ok" | "empty" | "unsynced">;
  /**
   * score/maxScore are display hints for practice; assessment parents ignore them
   * and use `answers` for the server finish payload.
   */
  onFinish: (
    score: number,
    maxScore: number,
    misses: number,
    answers?: FinishAnswers,
  ) => void;
  onHeartsEmpty?: () => void;
  /** When set, correctness is decided by the server (assessment). */
  onEvaluate?: (event: AttemptEvent) => Promise<EvaluateEventResult>;
};
