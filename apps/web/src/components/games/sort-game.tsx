"use client";

import { simplifyGameContent } from "@jose/shared";
import type { AssessmentSort, SortGame as SortContent, SortItem } from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import type { PlayBoardProps } from "./play-types";
import {
  allChipsPlaced,
  formatSortWhy,
  gradeSortCheck,
  scoredSortItems,
} from "./sort-grade";
import { PlaceGhost, usePlaceDrag } from "./use-place-drag";
import { GameBoard } from "./game-board";

const CHEST_BODY = ["#dcf3ff", "#dff5ce", "#fff2be", "#ffe1e7"] as const;
const CHEST_SHADOW = ["#1cb0f6", "#83ce54", "#ebc653", "#ed97aa"] as const;

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

type SortPlayContent = SortContent | AssessmentSort;

function chipSource(item: SortPlayContent["items"][number]) {
  return "source" in item ? item.source : undefined;
}

function isAuthorSort(game: SortPlayContent): game is SortContent {
  return game.items.some((item) => "bucketId" in item && item.bucketId);
}

export function SortGame({
  game: sourceGame,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onEvaluate,
  onChange,
}: {
  game: SortPlayContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: SortContent) => void;
} & Partial<PlayBoardProps>) {
  const game = useMemo(() => isAuthorSort(sourceGame) ? simplifyGameContent(sourceGame) as SortContent : sourceGame, [sourceGame]);
  if (mode === "build" && onChange && isAuthorSort(game)) {
    return <SortBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <SortPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
      onEvaluate={onEvaluate}
    />
  );
}

function SortPlay({
  game,
  disabled,
  onMiss,
  onFinish,
  onEvaluate,
}: { game: SortPlayContent } & PlayBoardProps) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState<Record<string, true>>({});
  const [shake, setShake] = useState(false);
  const missesRef = useRef(0);
  const { playCue } = useMotionSound();
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
    if (onEvaluate) {
      const result = await onEvaluate({ type: "sort_check", placements: placed });
      if (result.perfect) {
        const all: Record<string, true> = {};
        for (const item of game.items) all[item.id] = true;
        setLocked(all);
        playCue("accept");
        onFinish(autoCount - missesRef.current, autoCount, missesRef.current, {
          type: "sort",
          placements: placed,
        });
        return;
      }
      missesRef.current += 1;
      playCue("reject");
      const nextLocked: Record<string, true> = { ...locked };
      for (const id of result.correctIds ?? []) nextLocked[id] = true;
      const nextPlaced = { ...placed };
      for (const item of game.items) {
        if (!nextLocked[item.id]) delete nextPlaced[item.id];
      }
      setPlaced(nextPlaced);
      setLocked(nextLocked);
      drag.select(null);
      setShake(true);
      window.setTimeout(() => setShake(false), 550);
      await onMiss(result.feedback ?? null);
      return;
    }
    const result = gradeSortCheck(game.items, placed);
    if (result.perfect) {
      const all: Record<string, true> = {};
      for (const item of game.items) all[item.id] = true;
      setLocked(all);
      playCue("accept");
      onFinish(autoCount - missesRef.current, autoCount, missesRef.current, {
        type: "sort",
        placements: placed,
      });
      return;
    }
    missesRef.current += 1;
    playCue("reject");
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
  const autoCount = scoredSortItems(game.items).length || game.items.length;

  return (
    <GameBoard scene="sort" step={`${Object.keys(placed).length} of ${game.items.length} cards placed`}>
    <div className={`flex flex-col gap-3 pb-28 sm:gap-5 sm:pb-0 ${shake ? "snap-back" : ""}`}>
      <PlaceGhost ghost={drag.ghost} />
      <div
        className={`grid gap-3 sm:gap-5 ${
          three ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
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
                          {chipSource(item)?.citation || chipSource(item)?.label ? (
                            <p className="mt-1 px-2 text-[10px] font-bold text-emerald-800/80">
                              Source: {chipSource(item)?.citation || chipSource(item)?.label}
                            </p>
                          ) : null}
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
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-xs font-extrabold ring-2 sm:text-sm ${
                            on
                              ? "bg-[#dcf3ff] text-[#096d9b] ring-[#1cb0f6]"
                              : "bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-[var(--jose-rule)]"
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
                  Tap to place
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
              Your cards
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
                    className={`min-h-12 shrink-0 whitespace-nowrap touch-manipulation select-none rounded-xl px-4 text-sm font-extrabold ring-2 ${
                      lifting
                        ? "cursor-grabbing bg-violet-100 text-violet-400 opacity-40 ring-violet-200"
                        : on
                          ? "cursor-grab bg-[#dcf3ff] text-[#096d9b] ring-[#1cb0f6]"
                          : "cursor-grab bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-[var(--jose-rule)]"
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
          className="jose-button w-full"
        >
          Check
        </button>
      </div>
    </div>
    </GameBoard>
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

  function patchItem(itemId: string, next: Partial<SortItem>) {
    onChange({
      ...game,
      items: game.items.map((item) => (item.id === itemId ? { ...item, ...next } : item)),
    });
  }

  function patchSource(item: SortItem, key: "label" | "citation", value: string) {
    const label = (key === "label" ? value : item.source?.label ?? "").trim();
    if (!label) {
      patchItem(item.id, { source: undefined });
      return;
    }
    const citation = key === "citation" ? value : item.source?.citation;
    patchItem(item.id, {
      source: { ...item.source, label, ...(citation?.trim() ? { citation } : {}) },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Name the categories, then add cards to the correct category.
      </p>
      <div
        className={`grid gap-3 sm:gap-5 ${
          three ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
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
                  aria-label="Category name"
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
                        onChange={(e) => patchItem(item.id, { label: e.target.value })}
                        className="w-full rounded-full bg-white px-3 py-1 text-sm font-extrabold ring-1 ring-black/10"
                      />
                      <input
                        value={item.why ?? ""}
                        placeholder="Why"
                        onChange={(e) => patchItem(item.id, { why: e.target.value || undefined })}
                        className="mt-1 w-full rounded-full bg-white/70 px-3 py-1 text-xs font-semibold ring-1 ring-black/5"
                      />
                      <input
                        value={item.source?.label ?? ""}
                        placeholder="Source label"
                        onChange={(e) => patchSource(item, "label", e.target.value)}
                        className="mt-1 w-full rounded-full bg-white/70 px-3 py-1 text-xs font-semibold ring-1 ring-black/5"
                      />
                      <input
                        value={item.source?.citation ?? ""}
                        placeholder="Source citation"
                        onChange={(e) => patchSource(item, "citation", e.target.value)}
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
                        scoring: "auto",
                      },
                    ],
                  })
                }
              >
                + Add card
              </button>
            </SortChest>
          </div>
        ))}
      </div>
      {game.buckets.length < 4 ? (
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-1 text-sm font-extrabold text-violet-700"
          onClick={() =>
            onChange({
              ...game,
              buckets: [...game.buckets, { id: `b${Date.now()}`, label: "New category", role: "category" }],
            })
          }
        >
          <Plus className="size-4" /> Add category
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
      <div className="mb-3 text-center text-base font-extrabold text-[var(--jose-text)]">
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
          inviting ? "ring-4 ring-[#1cb0f6]" : ""
        }`}
        style={{ boxShadow: `0 3px 0 ${shadow}` }}
      >
        <div className="p-3" style={{ background: body }}>
          <div className="min-h-[7rem] rounded-xl bg-[var(--jose-surface)] p-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
