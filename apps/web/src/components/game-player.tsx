"use client";

import { hintFor, labelFor } from "@/lib/game-copy";
import {
  ApiError,
  evaluateAttempt,
  finishAttempt,
  recordMiss,
} from "@/lib/path-api";
import {
  HEARTS_EMPTY_CODE,
  firstTryScore,
  pieceCount,
  type AssessmentGame,
  type AttemptEvent,
  type AttemptInfo,
  type FinishAnswers,
  type GameContent,
} from "@jose/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BlankGame } from "./games/blank-game";
import {
  GameFrame,
  HeartsBreak,
  StarCelebration,
  WhySheet,
} from "./games/game-stage";
import { MemoryGame } from "./games/memory-game";
import type { WhyPayload } from "./games/play-types";
import { QuizGame } from "./games/quiz-game";
import { SortGame } from "./games/sort-game";
import { TimelineGame } from "./games/timeline-game";

export function GamePlayer({
  levelId,
  moduleId,
  title,
  game,
  attempt,
  hearts: startHearts,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  game: AssessmentGame;
  attempt: AttemptInfo;
  hearts: number;
}) {
  const router = useRouter();
  const [hearts, setHearts] = useState(startHearts);
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [empty, setEmpty] = useState(startHearts <= 0);
  const pendingEmpty = useRef(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    stars: number;
  } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState(attempt.id);

  async function onMiss(
    payload: WhyPayload | null,
    opts?: { hold?: boolean },
  ): Promise<"ok" | "empty"> {
    setBusy(true);
    setError(null);
    try {
      const parsed = await recordMiss(levelId);
      setHearts(parsed.learner.hearts);
      if (payload) setWhy(payload);
      if (parsed.learner.hearts <= 0) {
        if (payload) pendingEmpty.current = true;
        else if (!opts?.hold) setEmpty(true);
        return "empty";
      }
      return "ok";
    } catch (err) {
      if (err instanceof ApiError && err.code === HEARTS_EMPTY_CODE) {
        setHearts(0);
        if (payload) {
          setWhy(payload);
          pendingEmpty.current = true;
        } else if (!opts?.hold) {
          setEmpty(true);
        }
        return "empty";
      }
      setError(err instanceof Error ? err.message : "Could not save the miss");
      if (payload) setWhy(payload);
      return "ok";
    } finally {
      setBusy(false);
    }
  }

  async function onEvaluate(event: AttemptEvent) {
    return evaluateAttempt(attemptId, event);
  }

  async function onFinish(
    _score: number,
    _max: number,
    _misses: number,
    answers?: FinishAnswers,
  ) {
    if (!answers) {
      setError("Missing answers for assessment finish");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const finished = await finishAttempt(attemptId, { answers });
      setResult({
        score: finished.score,
        maxScore: finished.maxScore,
        stars: finished.stars,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save score");
    } finally {
      setBusy(false);
    }
  }

  if (empty) {
    return <HeartsBreak moduleId={moduleId} />;
  }

  if (result) {
    return (
      <StarCelebration
        title={title}
        score={result.score}
        maxScore={result.maxScore}
        stars={result.stars}
        error={error}
        onRetry={() => {
          setResult(null);
          setError(null);
          setNonce((n) => n + 1);
          // Reload so a fresh server attempt is issued for the current revision.
          router.refresh();
          setAttemptId(attempt.id);
        }}
        onContinue={() => {
          router.push(`/learn/${moduleId}`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <GameFrame
        title={title}
        hint={hintFor(game.type)}
        hearts={hearts}
        showHearts
        progress={labelFor(game.type)}
        wide={game.type === "timeline"}
      >
        {error ? <p className="mb-4 text-sm font-bold text-rose-600" role="alert">{error}</p> : null}
        <GameSwitch
          key={nonce}
          game={game}
          disabled={busy || Boolean(why)}
          onMiss={onMiss}
          onFinish={onFinish}
          onEvaluate={onEvaluate}
          onHeartsEmpty={() => setEmpty(true)}
        />
      </GameFrame>
      {why ? (
        <WhySheet
          why={why}
          onDismiss={() => {
            setWhy(null);
            if (pendingEmpty.current) {
              pendingEmpty.current = false;
              setEmpty(true);
            }
          }}
        />
      ) : null}
    </>
  );
}

export function GameSwitch({
  game,
  mode = "play",
  disabled,
  onMiss,
  onFinish,
  onEvaluate,
  onHeartsEmpty,
  onChange,
}: {
  game: GameContent | AssessmentGame;
  mode?: "play" | "build";
  disabled?: boolean;
  onMiss?: (
    why: WhyPayload | null,
    opts?: { hold?: boolean },
  ) => Promise<"ok" | "empty">;
  onFinish?: (
    score: number,
    maxScore: number,
    misses: number,
    answers?: FinishAnswers,
  ) => void;
  onEvaluate?: (event: AttemptEvent) => Promise<import("@jose/shared").EvaluateEventResult>;
  onHeartsEmpty?: () => void;
  onChange?: (game: GameContent) => void;
}) {
  switch (game.type) {
    case "quiz":
      return (
        <QuizGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "quiz" }>) => void) | undefined}
        />
      );
    case "memory":
      return (
        <MemoryGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onEvaluate={onEvaluate}
          onHeartsEmpty={onHeartsEmpty}
          onChange={onChange as ((g: Extract<GameContent, { type: "memory" }>) => void) | undefined}
        />
      );
    case "timeline":
      return (
        <TimelineGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "timeline" }>) => void) | undefined}
        />
      );
    case "blank":
      return (
        <BlankGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "blank" }>) => void) | undefined}
        />
      );
    case "sort":
      return (
        <SortGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "sort" }>) => void) | undefined}
        />
      );
  }
}

/** Practice / playtest helper — local scoring only, never writes grades. */
export function localPracticeFinish(
  game: GameContent,
  misses: number,
): { score: number; maxScore: number; stars: 1 | 2 | 3 } {
  return firstTryScore(pieceCount(game), misses);
}
