"use client";

import { hintFor, labelFor } from "@/lib/game-copy";
import { recordMiss, submitAttempt } from "@/lib/path-api";
import {
  firstTryScore,
  pieceCount,
  type GameContent,
} from "@jose/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlankGame } from "./games/blank-game";
import {
  GameFrame,
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
  nextLevelId,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  game: GameContent;
  hearts?: number;
  nextLevelId?: string | null;
}) {
  const router = useRouter();
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    stars: number;
    continueHref?: string;
  } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onMiss(
    payload: WhyPayload | null,
  ): Promise<"ok" | "empty"> {
    setBusy(true);
    setError(null);
    try {
      await recordMiss(levelId);
      if (payload) setWhy(payload);
      // Learning mode never empties hearts / locks coursework.
      return "ok";
    } catch (err) {
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
      const saved = await submitAttempt(levelId, {
        score: scored.score,
        maxScore: scored.maxScore,
        payload: { misses, stars: scored.stars },
        mode: "learning",
      });
      setResult({
        ...scored,
        continueHref:
          saved.continueHref ??
          (nextLevelId
            ? `/learn/${moduleId}/${nextLevelId}`
            : `/learn/${moduleId}`),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save score");
      setResult({
        ...scored,
        continueHref: nextLevelId
          ? `/learn/${moduleId}/${nextLevelId}`
          : `/learn/${moduleId}`,
      });
    } finally {
      setBusy(false);
    }
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
          router.push(result.continueHref ?? `/learn/${moduleId}`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <GameFrame
        title={title}
        hint={`${hintFor(game.type)} Mistakes never lock required coursework.`}
        hearts={0}
        showHearts={false}
        progress={labelFor(game.type)}
        wide={game.type === "timeline"}
      >
        {error ? (
          <p className="mb-4 text-sm font-semibold text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        <GameSwitch
          key={nonce}
          game={game}
          disabled={busy || Boolean(why)}
          onMiss={onMiss}
          onFinish={onFinish}
        />
      </GameFrame>
      {why ? (
        <WhySheet
          why={why}
          onDismiss={() => {
            setWhy(null);
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
