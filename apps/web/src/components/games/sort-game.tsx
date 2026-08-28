"use client";

import type { SortGame as SortContent } from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { PlayBoardProps } from "./play-types";
import { allChipsPlaced, formatSortWhy, gradeSortCheck } from "./sort-grade";
import { PlaceGhost, usePlaceDrag } from "./use-place-drag";

const CHEST_BODY = ["#f59e0b", "#f97316", "#eab308"] as const;
const CHEST_SHADOW = ["#d97706", "#c2410c", "#a16207"] as const;

function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

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
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState<Record<string, true>>({});
  const [shake, setShake] = useState(false);
  const missesRef = useRef(0);
  const wide = useWideScreen();
  const drag = usePlaceDrag({
    disabled,
    dropSelector: "[data-sort-bucket]",
    allowDrag: wide,
    onDrop: (itemId, target) => {
      const bucketId = target.dataset.sortBucket;
      if (!bucketId) return;
      putChip(bucketId, itemId);
    },
  });

  function putChip(bucketId: string, itemId = drag.selectedRef.current) {
    if (!itemId || disabled || locked[itemId]) return;
    if (!game.items.some((item) => item.id === itemId)) return;
    setPlaced((prev) => ({ ...prev, [itemId]: bucketId }));
    drag.select(null);
  }

  function returnChip(itemId: string) {
    if (disabled || locked[itemId]) return;
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    drag.select(null);
  }

  async function check() {
    if (disabled || !allChipsPlaced(game.items, placed)) return;
    const result = gradeSortCheck(game.items, placed);
    if (result.perfect) {
      const all: Record<string, true> = {};
      for (const item of game.items) all[item.id] = true;
      setLocked(all);
      onFinish(game.items.length - missesRef.current, game.items.length, missesRef.current);
      return;
    }
    missesRef.current += 1;
    const nextPlaced = { ...placed };
    const nextLocked: Record<string, true> = { ...locked };
    for (const id of result.correctIds) nextLocked[id] = true;
    for (const item of result.wrongItems) delete nextPlaced[item.id];
    setPlaced(nextPlaced);
    setLocked(nextLocked);
    drag.select(null);
    setShake(true);
    window.setTimeout(() => setShake(false), 550);
    const why = formatSortWhy(result.wrongItems);
    await onMiss(why);
  }

  const leftover = game.items.filter((item) => !placed[item.id]);
  const three = game.buckets.length === 3;
  const hovering = drag.overEl?.dataset.sortBucket ?? null;
  const canCheck = allChipsPlaced(game.items, placed);

  return (
    <div className={`flex flex-col gap-3 pb-28 sm:gap-5 sm:pb-0 ${shake ? "snap-back" : ""}`}>
      <PlaceGhost ghost={drag.ghost} />
      <div
        className={`grid gap-3 sm:gap-5 ${
          three ? "grid-cols-1 min-[520px]:grid-cols-3" : "grid-cols-2"
        }`}
      >
        {game.buckets.map((bucket, index) => {
          const chips = game.items.filter((item) => placed[item.id] === bucket.id);
          const active = hovering === bucket.id || Boolean(drag.selected);
          return (
            <SortChest
              key={bucket.id}
              bucketId={bucket.id}
              label={bucket.label}
              palette={index}
              active={hovering === bucket.id}
              inviting={active}
              onChoose={() => putChip(bucket.id)}
            >
              {chips.length > 0 ? (
                <ul className="space-y-1">
                  {chips.map((item) => {
                    const isLocked = Boolean(locked[item.id]);
                    const on = drag.selected === item.id;
                    if (isLocked) {
                      return (
                        <li key={item.id}>
                          <span className="block rounded-full bg-emerald-50 px-3 py-1.5 text-left text-xs font-extrabold text-emerald-900 ring-2 ring-emerald-300 sm:text-sm">
                            {item.label}
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (on) {
                              returnChip(item.id);
                              return;
                            }
                            drag.select(item.id);
                          }}
                          className={`w-full rounded-full px-3 py-1.5 text-left text-xs font-extrabold ring-2 sm:text-sm ${
                            on
                              ? "bg-violet-600 text-white ring-violet-700"
                              : "bg-white text-slate-800 ring-black/10"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-1 py-3 text-center text-[10px] font-extrabold uppercase tracking-wide text-amber-800/70">
                  In here
                </p>
              )}
            </SortChest>
          );
        })}
      </div>
      <div className="z-20 -mx-4 border-t border-amber-200/70 bg-[var(--jose-cream)] px-4 py-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        {leftover.length > 0 ? (
          <>
            <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 sm:hidden">
              Your chips
            </p>
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 sm:mb-3 sm:flex-wrap sm:overflow-visible">
              {leftover.map((item) => {
                const on = drag.selected === item.id;
                const lifting = drag.dragging === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onPointerDown={(event) => drag.onPointerDown(event, item.id, item.label)}
                    onPointerMove={drag.onPointerMove}
                    onPointerUp={drag.onPointerUp}
                    onPointerCancel={drag.onPointerCancel}
                    onClick={() => {
                      if (drag.consumeClick()) return;
                      drag.select(on ? null : item.id);
                    }}
                    className={`min-h-12 shrink-0 whitespace-nowrap touch-manipulation select-none rounded-full px-4 text-sm font-extrabold ring-2 ${
                      lifting
                        ? "cursor-grabbing bg-violet-100 text-violet-400 opacity-40 ring-violet-200"
                        : on
                          ? "cursor-grab bg-violet-600 text-white ring-violet-700"
                          : "cursor-grab bg-white text-slate-800 ring-black/10"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
        <button
          type="button"
          disabled={disabled || !canCheck}
          onClick={() => void check()}
          className="w-full rounded-full bg-violet-600 px-5 py-3 text-base font-extrabold text-white shadow-md disabled:bg-violet-200 disabled:text-white"
        >
          Check
        </button>
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
  const three = game.buckets.length === 3;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Name the chests, then put each chip in the correct one. That’s the answer key.
      </p>
      <div
        className={`grid gap-3 sm:gap-5 ${
          three ? "grid-cols-1 min-[520px]:grid-cols-3" : "grid-cols-2"
        }`}
      >
        {game.buckets.map((bucket, i) => (
          <div key={bucket.id}>
            <SortChest
              bucketId={bucket.id}
              label={bucket.label}
              palette={i}
              inviting
              labelSlot={
                <input
                  value={bucket.label}
                  aria-label="Chest name"
                  onChange={(e) => {
                    const buckets = [...game.buckets];
                    buckets[i] = { ...bucket, label: e.target.value };
                    onChange({ ...game, buckets });
                  }}
                  className="w-full bg-transparent text-center font-display text-[11px] font-semibold outline-none sm:text-sm"
                />
              }
            >
              <ul className="space-y-2">
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
                        className="w-full rounded-full bg-white px-3 py-1 text-sm font-extrabold ring-1 ring-black/10"
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
                        className="mt-1 w-full rounded-full bg-white/70 px-3 py-1 text-xs font-semibold ring-1 ring-black/5"
                      />
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs font-extrabold text-amber-900"
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
            </SortChest>
          </div>
        ))}
      </div>
      {game.buckets.length < 3 ? (
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-1 text-sm font-extrabold text-violet-700"
          onClick={() =>
            onChange({
              ...game,
              buckets: [...game.buckets, { id: `b${Date.now()}`, label: "New chest" }],
            })
          }
        >
          <Plus className="size-4" /> Add chest
        </button>
      ) : null}
    </div>
  );
}

function SortChest({
  bucketId,
  label,
  labelSlot,
  palette = 0,
  active = false,
  inviting = false,
  onChoose,
  children,
}: {
  bucketId: string;
  label: string;
  labelSlot?: ReactNode;
  palette?: number;
  active?: boolean;
  inviting?: boolean;
  onChoose?: () => void;
  children?: ReactNode;
}) {
  const body = CHEST_BODY[palette % CHEST_BODY.length]!;
  const shadow = CHEST_SHADOW[palette % CHEST_SHADOW.length]!;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onChoose) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChoose();
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="mb-1.5 rounded-2xl bg-white px-2 py-1.5 text-center font-display text-xs font-semibold text-amber-950 shadow-[0_2px_0_rgb(180_83_9/18%)] sm:text-sm">
        {labelSlot ?? label}
      </div>
      <div
        data-sort-bucket={bucketId}
        role={onChoose ? "button" : undefined}
        tabIndex={onChoose ? 0 : undefined}
        aria-label={onChoose ? `${label} chest` : undefined}
        onClick={onChoose}
        onKeyDown={onKeyDown}
        className={`overflow-hidden rounded-[1.15rem] outline-none ${active ? "scale-[1.03]" : ""} ${
          inviting ? "ring-2 ring-violet-400" : ""
        }`}
        style={{ boxShadow: `0 3px 0 ${shadow}` }}
      >
        <div className="relative h-4 border-b-[3px] border-amber-600" style={{ background: "#f5c518" }}>
          <span
            aria-hidden
            className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-[40%] rounded-full bg-[#fff8ef] ring-2 ring-amber-800"
          />
        </div>
        <div className="px-2 pb-2 pt-3" style={{ background: body }}>
          <div className="min-h-[4.5rem] rounded-xl bg-[#fff8ef] p-1.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
