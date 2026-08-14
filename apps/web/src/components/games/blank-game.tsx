"use client";

import type { BlankGame } from "@jose/shared";
import { useMemo, useState } from "react";

function bankFor(answer: string, decoys: string[]) {
  const next = [answer, ...decoys];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export function BlankGame({
  game,
  disabled,
  onFinish,
}: {
  game: BlankGame;
  disabled: boolean;
  onFinish: (score: number, maxScore: number) => void;
}) {
  const banks = useMemo(
    () => game.items.map((item) => bankFor(item.answer, item.decoys)),
    [game.items],
  );
  const [picks, setPicks] = useState<(string | null)[]>(
    () => game.items.map(() => null),
  );

  const ready = picks.every(Boolean);

  function submit() {
    const score = game.items.filter(
      (item, i) => picks[i]?.trim().toLowerCase() === item.answer.trim().toLowerCase(),
    ).length;
    onFinish(score, game.items.length);
  }

  return (
    <div className="space-y-6">
      {game.items.map((item, i) => (
        <div key={i} className="rounded-[1.75rem] bg-white p-4 ring-1 ring-black/10 sm:p-5">
          <p className="text-lg font-extrabold text-slate-800">
            {item.sentence.replace("___", picks[i] ? picks[i]! : "_____")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {banks[i]!.map((word) => (
              <button
                key={word}
                type="button"
                disabled={disabled}
                onClick={() =>
                  setPicks((prev) => {
                    const next = [...prev];
                    next[i] = word;
                    return next;
                  })
                }
                className={`rounded-full px-3 py-2 text-sm font-extrabold ring-2 ${
                  picks[i] === word
                    ? "bg-violet-600 text-white ring-violet-700"
                    : "bg-slate-50 text-slate-700 ring-slate-200"
                }`}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled || !ready}
        onClick={submit}
        className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
      >
        Check answers
      </button>
    </div>
  );
}
