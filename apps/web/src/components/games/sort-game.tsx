"use client";

import type { SortGame } from "@jose/shared";
import { useState } from "react";

export function SortGame({
  game,
  disabled,
  onFinish,
}: {
  game: SortGame;
  disabled: boolean;
  onFinish: (score: number, maxScore: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Record<string, string>>({});

  function assign(bucketId: string) {
    if (!selected || disabled) return;
    setPlaced((prev) => ({ ...prev, [selected]: bucketId }));
    setSelected(null);
  }

  const ready = game.items.every((item) => placed[item.id]);

  function submit() {
    const score = game.items.filter((item) => placed[item.id] === item.bucketId)
      .length;
    onFinish(score, game.items.length);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-500">
        Tap a card, then tap the bucket it belongs in.
      </p>
      <div className="flex flex-wrap gap-2">
        {game.items.map((item) => {
          if (placed[item.id]) return null;
          const on = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-extrabold ring-2 ${
                on
                  ? "bg-violet-600 text-white ring-violet-700"
                  : "bg-white text-slate-800 ring-black/10"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className={`grid gap-3 ${game.buckets.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {game.buckets.map((bucket) => (
          <button
            key={bucket.id}
            type="button"
            disabled={disabled}
            onClick={() => assign(bucket.id)}
            className="min-h-[8rem] rounded-[1.75rem] bg-white p-4 text-left ring-2 ring-black/10"
          >
            <p className="font-display text-xl font-semibold text-slate-800">
              {bucket.label}
            </p>
            <ul className="mt-3 space-y-1">
              {game.items
                .filter((item) => placed[item.id] === bucket.id)
                .map((item) => (
                  <li key={item.id}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaced((prev) => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        });
                        setSelected(item.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPlaced((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                          setSelected(item.id);
                        }
                      }}
                      className="inline-block rounded-full bg-violet-100 px-3 py-1 text-sm font-extrabold text-violet-800"
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
            </ul>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !ready}
        onClick={submit}
        className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
      >
        Check buckets
      </button>
    </div>
  );
}
