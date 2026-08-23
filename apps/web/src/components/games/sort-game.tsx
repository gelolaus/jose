"use client";

import type { SortGame as SortContent } from "@jose/shared";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";

export function SortGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: SortContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: SortContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <SortBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return <SortPlay game={game} disabled={disabled} onMiss={onMiss} onFinish={onFinish} />;
}

function SortPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: SortContent } & PlayBoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [shake, setShake] = useState<string | null>(null);
  const missesRef = useRef(0);

  async function assign(bucketId: string) {
    if (!selected || disabled) return;
    const item = game.items.find((entry) => entry.id === selected);
    if (!item) return;
    if (item.bucketId !== bucketId) {
      setShake(bucketId);
      window.setTimeout(() => setShake(null), 550);
      const result = await onMiss({
        title: item.label,
        body:
          item.why?.trim() ||
          `That belongs in ${game.buckets.find((b) => b.id === item.bucketId)?.label ?? "another chest"}.`,
      });
      missesRef.current += 1;
      setSelected(null);
      if (result === "empty") return;
      return;
    }
    const next = { ...placed, [selected]: bucketId };
    setPlaced(next);
    setSelected(null);
    if (game.items.every((entry) => next[entry.id])) {
      onFinish(
        game.items.length - missesRef.current,
        game.items.length,
        missesRef.current,
      );
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-500">
        Tap a chip, then tap the chest it belongs in.
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
              onClick={() => setSelected(on ? null : item.id)}
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
      <div
        className={`grid gap-3 ${game.buckets.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {game.buckets.map((bucket) => (
          <button
            key={bucket.id}
            type="button"
            disabled={disabled}
            onClick={() => void assign(bucket.id)}
            className={`min-h-[9rem] rounded-[1.75rem] bg-gradient-to-b from-amber-100 to-amber-200 p-4 text-left shadow-md ring-2 ring-amber-300 ${
              shake === bucket.id ? "snap-back" : ""
            } ${selected ? "slot-glow" : ""}`}
          >
            <p className="font-display text-xl font-semibold text-amber-950">{bucket.label}</p>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-800/70">
              Chest
            </p>
            <ul className="mt-3 space-y-1">
              {game.items
                .filter((item) => placed[item.id] === bucket.id)
                .map((item) => (
                  <li
                    key={item.id}
                    className="rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-amber-950"
                  >
                    {item.label}
                  </li>
                ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}

function SortBuild({
  game,
  onChange,
}: {
  game: SortContent;
  onChange: (game: SortContent) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Name the chests, then put each chip in the correct one. That’s the answer key.
      </p>
      <div className={`grid gap-3 ${game.buckets.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {game.buckets.map((bucket, i) => (
          <div
            key={bucket.id}
            className="rounded-[1.75rem] bg-gradient-to-b from-amber-100 to-amber-200 p-4 ring-2 ring-amber-300"
          >
            <input
              value={bucket.label}
              onChange={(e) => {
                const buckets = [...game.buckets];
                buckets[i] = { ...bucket, label: e.target.value };
                onChange({ ...game, buckets });
              }}
              className="w-full bg-transparent font-display text-xl font-semibold outline-none"
            />
            <ul className="mt-3 space-y-2">
              {game.items
                .filter((item) => item.bucketId === bucket.id)
                .map((item) => (
                  <li key={item.id}>
                    <input
                      value={item.label}
                      onChange={(e) => {
                        const items = game.items.map((entry) =>
                          entry.id === item.id ? { ...entry, label: e.target.value } : entry,
                        );
                        onChange({ ...game, items });
                      }}
                      className="w-full rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold"
                    />
                    <input
                      value={item.why ?? ""}
                      placeholder="Why"
                      onChange={(e) => {
                        const items = game.items.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, why: e.target.value || undefined }
                            : entry,
                        );
                        onChange({ ...game, items });
                      }}
                      className="mt-1 w-full rounded-full bg-white/60 px-3 py-1 text-xs font-semibold"
                    />
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="mt-3 text-xs font-extrabold text-amber-950"
              onClick={() =>
                onChange({
                  ...game,
                  items: [
                    ...game.items,
                    {
                      id: `i${Date.now()}`,
                      label: "New item",
                      bucketId: bucket.id,
                    },
                  ],
                })
              }
            >
              + Chip in this chest
            </button>
          </div>
        ))}
      </div>
      {game.buckets.length < 3 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-extrabold text-violet-700"
          onClick={() =>
            onChange({
              ...game,
              buckets: [
                ...game.buckets,
                { id: `b${Date.now()}`, label: "New chest" },
              ],
            })
          }
        >
          <Plus className="size-4" /> Add chest
        </button>
      ) : null}
    </div>
  );
}
