"use client";

import { GameSwitch } from "@/components/game-player";
import {
  GameFrame,
  StarCelebration,
  WhySheet,
} from "@/components/games/game-stage";
import type { WhyPayload } from "@/components/games/play-types";
import { hintFor, labelFor } from "@/lib/game-copy";
import { submitPracticeAttempt } from "@/lib/path-api";
import { firstTryScore, pieceCount, type GameContent } from "@jose/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PracticeReviewPlayer({
  levelId,
  title,
  game,
}: {
  levelId: string;
  title: string;
  game: GameContent;
}) {
  const router = useRouter();
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    stars: number;
  } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  async function onMiss(payload: WhyPayload | null): Promise<"ok" | "empty"> {
    if (payload) setWhy(payload);
    return "ok";
  }

  async function onFinish(_score: number, _max: number, misses: number) {
    setBusy(true);
    setError(null);
    const scored = firstTryScore(pieceCount(game), misses);
    try {
      const saved = await submitPracticeAttempt({
        levelId,
        score: scored.score,
        maxScore: scored.maxScore,
        payload: { misses, stars: scored.stars },
      });
      setSavedNote(
        saved.marksAssignmentComplete
          ? null
          : "Saved as practice only — path assignment unchanged.",
      );
      setResult(scored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save practice");
      setResult(scored);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <StarCelebration
        timedOut={game.type === "memory" && result.score === 0}
        title={title}
        score={result.score}
        maxScore={result.maxScore}
        stars={result.stars}
        error={error ?? savedNote ?? undefined}
        onRetry={() => {
          setResult(null);
          setSavedNote(null);
          setNonce((n) => n + 1);
        }}
        onContinue={() => {
          router.push("/practice");
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <GameFrame
        title={title}
        hint={`${hintFor(game.type)} Practice saves do not complete formal assignments.`}
        hearts={0}
        showHearts={false}
        progress={labelFor(game.type)}
        scene={game.type}
        wide
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
      {why ? <WhySheet why={why} onDismiss={() => setWhy(null)} /> : null}
    </>
  );
}
