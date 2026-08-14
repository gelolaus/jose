"use client";

import type { TimelineGame } from "@jose/shared";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

function shuffledCopy(items: string[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  if (next.every((item, i) => item === items[i]) && next.length > 1) {
    [next[0], next[1]] = [next[1]!, next[0]!];
  }
  return next;
}

export function TimelineGame({
  game,
  disabled,
  onFinish,
}: {
  game: TimelineGame;
  disabled: boolean;
  onFinish: (score: number, maxScore: number) => void;
}) {
  const [order, setOrder] = useState(() => shuffledCopy(game.items));

  function move(index: number, direction: -1 | 1) {
    const next = [...order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap]!, next[index]!];
    setOrder(next);
  }

  function submit() {
    const score = order.filter((item, i) => item === game.items[i]).length;
    onFinish(score, game.items.length);
  }

  const hint = useMemo(() => "Oldest or first at the top.", []);

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">{hint}</p>
      <ol className="space-y-2">
        {order.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex items-center gap-2 rounded-3xl bg-white px-3 py-2 ring-1 ring-black/10"
          >
            <span className="w-7 text-center text-sm font-extrabold text-violet-600">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-base font-extrabold text-slate-800">
              {item}
            </span>
            <span className="flex flex-col">
              <button
                type="button"
                aria-label="Move up"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="rounded-lg p-1 text-slate-500 disabled:opacity-30"
              >
                <ChevronUp className="size-5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={disabled || index === order.length - 1}
                onClick={() => move(index, 1)}
                className="rounded-lg p-1 text-slate-500 disabled:opacity-30"
              >
                <ChevronDown className="size-5" strokeWidth={2.5} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={disabled}
        onClick={submit}
        className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
      >
        Check order
      </button>
    </div>
  );
}
