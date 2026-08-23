"use client";

import type { SortGame as SortContent } from "@jose/shared";
import { Plus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { PlayBoardProps } from "./play-types";
import { PlaceGhost, usePlaceDrag } from "./use-place-drag";

const CHEST_COLORS = [
  { lid: "#FFD56A", body: "#F08A3A", deep: "#D96B28" },
  { lid: "#FFC14D", body: "#E5724A", deep: "#C4512C" },
  { lid: "#F5C84C", body: "#E09A3C", deep: "#C67A24" },
] as const;

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
  const [shake, setShake] = useState<string | null>(null);
  const missesRef = useRef(0);
  const drag = usePlaceDrag({
    disabled,
    dropSelector: "[data-sort-bucket]",
    onDrop: (itemId, target) => {
      const bucketId = target.dataset.sortBucket;
      if (!bucketId) return;
      void assign(bucketId, itemId);
    },
  });
  const overBucket = drag.overEl?.dataset.sortBucket ?? null;

  async function assign(bucketId: string, itemId = drag.selectedRef.current) {
    if (!itemId || disabled) return;
    const item = game.items.find((entry) => entry.id === itemId);
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
      drag.select(null);
      if (result === "empty") return;
      return;
    }
    const next = { ...placed, [itemId]: bucketId };
    setPlaced(next);
    drag.select(null);
    if (game.items.every((entry) => next[entry.id])) {
      onFinish(
        game.items.length - missesRef.current,
        game.items.length,
        missesRef.current,
      );
    }
  }

  const leftover = game.items.filter((item) => !placed[item.id]);
  const three = game.buckets.length === 3;

  return (
    <div className="flex flex-col gap-3 pb-28 sm:gap-5 sm:pb-0">
      <PlaceGhost ghost={drag.ghost} />
      {leftover.length > 0 ? (
        <div className="order-2 z-20 -mx-4 border-t border-amber-200/70 bg-[var(--jose-cream)] px-4 py-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] sm:order-1 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 sm:hidden">
            Your chips
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory sm:flex-wrap sm:overflow-visible sm:pb-0 sm:snap-none">
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
                  className={`min-h-12 shrink-0 snap-start whitespace-nowrap touch-manipulation select-none rounded-full px-4 text-sm font-extrabold ring-2 sm:min-h-11 ${
                    lifting
                      ? "cursor-grabbing bg-violet-100 text-violet-400 ring-violet-200 opacity-40"
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
        </div>
      ) : null}
      <div
        className={`order-1 grid gap-3 sm:order-2 sm:gap-5 ${
          three ? "grid-cols-1 min-[520px]:grid-cols-3" : "grid-cols-2"
        }`}
      >
        {game.buckets.map((bucket, index) => {
          const chips = game.items.filter((item) => placed[item.id] === bucket.id);
          const hovering = overBucket === bucket.id;
          const inviting = Boolean(drag.selected) || hovering;
          return (
            <button
              key={bucket.id}
              type="button"
              data-sort-bucket={bucket.id}
              disabled={disabled}
              aria-label={`${bucket.label} chest`}
              onClick={() => void assign(bucket.id)}
              className={`group min-h-12 min-w-0 whitespace-normal touch-manipulation text-left ${
                hovering ? "scale-[1.03]" : ""
              } ${shake === bucket.id ? "snap-back" : ""}`}
            >
              <SortChest
                label={bucket.label}
                open={inviting || chips.length > 0}
                active={hovering}
                palette={index}
                wide={three}
              >
                {chips.length > 0 ? (
                  <ul className="space-y-1 p-0.5 sm:p-2">
                    {chips.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold leading-tight text-amber-950 sm:px-3 sm:py-1 sm:text-sm"
                      >
                        {item.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-amber-100/90 sm:px-2 sm:py-3 sm:text-xs">
                    In here
                  </p>
                )}
              </SortChest>
            </button>
          );
        })}
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
              label={bucket.label}
              open
              palette={i}
              wide={three}
              interactive
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
              <ul className="space-y-2 p-1 sm:p-2">
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
                        className="w-full rounded-full bg-amber-50 px-3 py-1 text-sm font-extrabold"
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
                        className="mt-1 w-full rounded-full bg-amber-50/70 px-3 py-1 text-xs font-semibold"
                      />
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                className="px-3 pb-2 text-xs font-extrabold text-amber-100"
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

function SortChest({
  label,
  labelSlot,
  open = false,
  active = false,
  palette = 0,
  wide = false,
  interactive = false,
  children,
}: {
  label: string;
  labelSlot?: ReactNode;
  open?: boolean;
  active?: boolean;
  palette?: number;
  wide?: boolean;
  interactive?: boolean;
  children?: ReactNode;
}) {
  const colors = CHEST_COLORS[palette % CHEST_COLORS.length]!;
  return (
    <span
      className={`toy-chest ${open ? "toy-chest-open" : ""} ${active ? "toy-chest-active" : ""} ${
        interactive ? "toy-chest-build" : ""
      }`}
    >
      <span className="toy-chest-tag">{labelSlot ?? label}</span>
      <span className={`toy-chest-art ${wide ? "toy-chest-art-wide" : ""}`}>
        <span className="toy-chest-sparkle" aria-hidden />
        <CuteChestSvg colors={colors} />
        <span className="toy-chest-mouth">{children}</span>
      </span>
    </span>
  );
}

function CuteChestSvg({
  colors,
}: {
  colors: (typeof CHEST_COLORS)[number];
}) {
  return (
    <svg viewBox="0 0 200 168" className="h-auto w-full overflow-visible" aria-hidden>
      <ellipse cx="100" cy="158" rx="72" ry="8" fill="#000" opacity="0.12" />
      <rect x="28" y="140" width="30" height="16" rx="8" fill={colors.deep} stroke="#7A3410" strokeWidth="3" />
      <rect x="142" y="140" width="30" height="16" rx="8" fill={colors.deep} stroke="#7A3410" strokeWidth="3" />
      <rect x="14" y="76" width="172" height="74" rx="34" fill={colors.body} stroke="#7A3410" strokeWidth="4" />
      <rect x="32" y="86" width="136" height="34" rx="17" fill="#3F1D0F" />
      <rect x="14" y="112" width="172" height="10" rx="5" fill="#F6D36A" stroke="#7A3410" strokeWidth="2" />
      <g className="toy-chest-lid-svg">
        <path
          d="M16 82c0-44 32-66 84-66s84 22 84 66H16z"
          fill={colors.lid}
          stroke="#7A3410"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <ellipse cx="62" cy="48" rx="22" ry="12" fill="#fff8e4" opacity="0.5" />
        <ellipse cx="50" cy="62" rx="14" ry="9" fill="#FF9EBA" />
        <ellipse cx="150" cy="62" rx="14" ry="9" fill="#FF9EBA" />
        <path d="M86 36c7-11 21-11 28 0" fill="none" stroke="#7A3410" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="100" cy="28" r="3.5" fill="#fff8e4" />
      </g>
      <circle cx="100" cy="128" r="19" fill="#FFE566" stroke="#7A3410" strokeWidth="4" />
      <circle cx="100" cy="125" r="6" fill="none" stroke="#7A3410" strokeWidth="2.5" />
      <path d="M100 131v9" stroke="#7A3410" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
