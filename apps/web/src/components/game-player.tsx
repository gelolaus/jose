"use client";

import { hintFor, labelFor } from "@/lib/game-copy";
import { ApiError, recordMiss, submitAttempt } from "@/lib/path-api";
import {
  HEARTS_EMPTY_CODE,
  firstTryScore,
  pieceCount,
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
  hearts: startHearts,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  game: GameContent;
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

  async function onFinish(_score: number, _max: number, misses: number) {
    setBusy(true);
    setError(null);
    const scored = firstTryScore(pieceCount(game), misses);
    try {
      await submitAttempt(levelId, {
        score: scored.score,
        maxScore: scored.maxScore,
        payload: { misses, stars: scored.stars },
      });
      setResult(scored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save score");
      setResult(scored);
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
          setNonce((n) => n + 1);
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
        {error ? <p className="mb-4 text-sm font-bold text-rose-600">{error}</p> : null}
        <GameSwitch
          key={nonce}
          game={game}
          disabled={busy || Boolean(why)}
          onMiss={onMiss}
          onFinish={onFinish}
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
  onHeartsEmpty,
  onChange,
}: {
  game: GameContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onMiss?: (
    why: WhyPayload | null,
    opts?: { hold?: boolean },
  ) => Promise<"ok" | "empty">;
  onFinish?: (score: number, maxScore: number, misses: number) => void;
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
          onChange={onChange as ((g: typeof game) => void) | undefined}
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
          onHeartsEmpty={onHeartsEmpty}
          onChange={onChange as ((g: typeof game) => void) | undefined}
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
          onChange={onChange as ((g: typeof game) => void) | undefined}
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
          onChange={onChange as ((g: typeof game) => void) | undefined}
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
          onChange={onChange as ((g: typeof game) => void) | undefined}
        />
      );
  }
}
