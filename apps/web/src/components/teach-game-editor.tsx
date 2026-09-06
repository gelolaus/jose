"use client";

import { GameSwitch } from "@/components/game-player";
import { firstTryScore, pieceCount, type GameContent } from "@jose/shared";
import { useState } from "react";
import { GameFrame, StarCelebration } from "./games/game-stage";
import type { WhyPayload } from "./games/play-types";

export function GameEditor({
  game,
  onSave,
  onChange,
}: {
  game: GameContent;
  onSave: (game: GameContent) => Promise<void>;
  onChange?: (game: GameContent) => void;
}) {
  const [draft, setDraft] = useState<GameContent>(game);
  const [tab, setTab] = useState<"build" | "play">("build");
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [preview, setPreview] = useState<{
    score: number;
    maxScore: number;
    stars: number;
  } | null>(null);
  const [playKey, setPlayKey] = useState(0);

  function updateDraft(next: GameContent) {
    setDraft(next);
    onChange?.(next);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(draft);
      }}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("build")}
          className={`rounded-full px-4 py-2 text-sm font-extrabold ${
            tab === "build" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          Build
        </button>
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            setWhy(null);
            setPlayKey((n) => n + 1);
            setTab("play");
          }}
          className={`rounded-full px-4 py-2 text-sm font-extrabold ${
            tab === "play" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          Playtest
        </button>
      </div>
      {tab === "build" ? (
        <GameSwitch mode="build" game={draft} onChange={updateDraft} />
      ) : preview ? (
        <StarCelebration
          title="Playtest"
          score={preview.score}
          maxScore={preview.maxScore}
          stars={preview.stars}
          onRetry={() => {
            setPreview(null);
            setPlayKey((n) => n + 1);
          }}
          onContinue={() => setTab("build")}
        />
      ) : (
        <GameFrame
          title="Playtest"
          hint="Hearts are off. This is only for you."
          wide={draft.type === "timeline"}
        >
          <GameSwitch
            key={playKey}
            mode="play"
            game={draft}
            disabled={Boolean(why)}
            onMiss={async (payload) => {
              if (payload) setWhy(payload);
              return "ok";
            }}
            onFinish={(_score, _max, misses) => {
              setPreview(firstTryScore(pieceCount(draft), misses));
            }}
          />
          {why ? (
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-950 ring-1 ring-amber-200"
              onClick={() => setWhy(null)}
            >
              <span className="block text-xs font-extrabold uppercase tracking-wide text-amber-700">
                {why.title}
              </span>
              {why.body}
              <span className="mt-2 block text-xs font-extrabold text-violet-700">Got it</span>
            </button>
          ) : null}
        </GameFrame>
      )}
      <button
        type="submit"
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white"
      >
        Save game
      </button>
    </form>
  );
}
