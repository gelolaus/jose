"use client";

import { submitAttempt } from "@/lib/path-api";
import type { GameContent } from "@jose/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlankGame } from "./games/blank-game";
import { MemoryGame } from "./games/memory-game";
import { QuizGame } from "./games/quiz-game";
import { SortGame } from "./games/sort-game";
import { TimelineGame } from "./games/timeline-game";

export function GamePlayer({
  levelId,
  moduleId,
  title,
  game,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  game: GameContent;
}) {
  const router = useRouter();
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(score: number, maxScore: number, payload?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await submitAttempt(levelId, { score, maxScore, payload });
      setResult({ score, maxScore });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save score");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-500">
          Score
        </p>
        <p className="font-display text-5xl font-semibold text-slate-800">
          {result.score}
          <span className="text-2xl text-slate-400">/{result.maxScore}</span>
        </p>
        <p className="text-base font-semibold text-slate-600">{title}</p>
        {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setNonce((n) => n + 1);
            }}
            className="flex-1 rounded-full bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-700"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => {
              router.push(`/learn/${moduleId}`);
              router.refresh();
            }}
            className="flex-1 rounded-full bg-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-md"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
        {title}
      </h1>
      {error ? <p className="mb-4 text-sm font-bold text-rose-600">{error}</p> : null}
      <GameSwitch
        key={nonce}
        game={game}
        disabled={busy}
        onFinish={onFinish}
      />
    </div>
  );
}

function GameSwitch({
  game,
  disabled,
  onFinish,
}: {
  game: GameContent;
  disabled: boolean;
  onFinish: (score: number, maxScore: number, payload?: unknown) => void;
}) {
  switch (game.type) {
    case "quiz":
      return <QuizGame game={game} disabled={disabled} onFinish={onFinish} />;
    case "memory":
      return <MemoryGame game={game} disabled={disabled} onFinish={onFinish} />;
    case "timeline":
      return <TimelineGame game={game} disabled={disabled} onFinish={onFinish} />;
    case "blank":
      return <BlankGame game={game} disabled={disabled} onFinish={onFinish} />;
    case "sort":
      return <SortGame game={game} disabled={disabled} onFinish={onFinish} />;
  }
}
