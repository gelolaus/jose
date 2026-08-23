"use client";

import type { TimelineGame as TimelineContent, TimelineItem } from "@jose/shared";
import { shuffledCopy } from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";
import { PlaceGhost, usePlaceDrag } from "./use-place-drag";

export function TimelineGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: TimelineContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: TimelineContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <TimelineBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <TimelinePlay game={game} disabled={disabled} onMiss={onMiss} onFinish={onFinish} />
  );
}

function TimelinePlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: TimelineContent } & PlayBoardProps) {
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [shakeSlot, setShakeSlot] = useState<number | null>(null);
  const missesRef = useRef(0);
  const [bank, setBank] = useState(game.items);
  const drag = usePlaceDrag({
    disabled,
    dropSelector: "[data-timeline-slot]",
    onDrop: (itemId, target) => {
      const slot = Number(target.dataset.timelineSlot);
      if (!Number.isInteger(slot)) return;
      void dropOn(slot, itemId);
    },
  });

  useEffect(() => {
    const copy = shuffledCopy(game.items);
    if (copy.length > 1 && copy.every((item, i) => item.id === game.items[i]?.id)) {
      [copy[0], copy[1]] = [copy[1]!, copy[0]!];
    }
    setBank(copy);
  }, [game.items]);

  const remaining = bank.filter((item) => !Object.values(placed).includes(item.id));
  const overSlot =
    drag.overEl?.dataset.timelineSlot !== undefined
      ? Number(drag.overEl.dataset.timelineSlot)
      : null;

  async function dropOn(slot: number, itemId = drag.selectedRef.current) {
    if (disabled || itemId === null || placed[slot]) return;
    const item = game.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const correct = game.items[slot]?.id === itemId;
    if (!correct) {
      setShakeSlot(slot);
      window.setTimeout(() => setShakeSlot(null), 550);
      const result = await onMiss({
        title: item.label,
        body:
          item.why?.trim() ||
          `This belongs at ${game.items.findIndex((entry) => entry.id === itemId) + 1}, not here.`,
      });
      missesRef.current += 1;
      drag.select(null);
      if (result === "empty") return;
      return;
    }
    const next = { ...placed, [slot]: itemId };
    setPlaced(next);
    drag.select(null);
    if (Object.keys(next).length === game.items.length) {
      onFinish(
        game.items.length - missesRef.current,
        game.items.length,
        missesRef.current,
      );
    }
  }

  return (
    <div className="space-y-6">
      <PlaceGhost ghost={drag.ghost} />
      <TimelineRail
        items={game.items}
        placed={placed}
        selected={drag.selected}
        overSlot={overSlot}
        shakeSlot={shakeSlot}
        onSlot={(slot) => void dropOn(slot)}
      />
      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-violet-500">
          Events
        </p>
        <div className="flex flex-wrap gap-2">
          {remaining.map((item) => {
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
                className={`touch-none select-none rounded-2xl px-4 py-3 text-left text-sm font-extrabold shadow-sm ring-2 transition ${
                  lifting
                    ? "cursor-grabbing bg-violet-100 text-violet-400 ring-violet-200 opacity-40"
                    : on
                      ? "cursor-grab bg-violet-600 text-white ring-violet-700"
                      : "cursor-grab bg-white text-slate-800 ring-black/10 hover:bg-violet-50"
                }`}
              >
                {item.year ? (
                  <span className="mb-1 block text-[11px] uppercase tracking-wide opacity-80">
                    {item.year}
                  </span>
                ) : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineRail({
  items,
  placed,
  selected,
  overSlot,
  shakeSlot,
  onSlot,
  filled,
  onEdit,
}: {
  items: TimelineItem[];
  placed?: Record<number, string>;
  selected?: string | null;
  overSlot?: number | null;
  shakeSlot?: number | null;
  onSlot?: (index: number) => void;
  filled?: boolean;
  onEdit?: (index: number) => void;
}) {
  return (
    <ol className="relative mx-auto max-w-xl pl-2">
      <span
        className="absolute top-4 bottom-4 left-[1.15rem] w-1 rounded-full bg-gradient-to-b from-amber-300 via-violet-400 to-rose-400 sm:left-[1.35rem]"
        aria-hidden
      />
      {items.map((item, index) => {
        const placedId = placed?.[index];
        const shown = filled ? item : items.find((entry) => entry.id === placedId);
        const side = index % 2 === 0 ? "left" : "right";
        const waiting = Boolean(!shown && (selected || overSlot === index));
        return (
          <li
            key={item.id}
            data-timeline-slot={onSlot && !shown ? String(index) : undefined}
            className="relative flex gap-4 py-3 sm:gap-5"
          >
            <button
              type="button"
              disabled={!onSlot && !onEdit}
              onClick={() => (onEdit ? onEdit(index) : onSlot?.(index))}
              className={`relative z-[1] mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold shadow-md ring-4 ring-[var(--jose-cream)] sm:size-10 ${
                shown
                  ? "bg-violet-600 text-white"
                  : `bg-white text-violet-500 ${waiting ? "slot-glow" : ""}`
              } ${shakeSlot === index ? "snap-back" : ""} ${
                overSlot === index && !shown ? "scale-110 bg-amber-200 text-amber-800" : ""
              }`}
            >
              {index + 1}
            </button>
            <button
              type="button"
              disabled={!onSlot && !onEdit}
              onClick={() => (onEdit ? onEdit(index) : onSlot?.(index))}
              className={`min-w-0 flex-1 rounded-[1.4rem] px-4 py-3 text-left shadow-sm ring-2 transition sm:px-5 sm:py-4 ${
                shown
                  ? "bg-white ring-violet-200"
                  : overSlot === index
                    ? "border-2 border-amber-400 bg-amber-50 ring-amber-200"
                    : "border-2 border-dashed border-violet-300 bg-violet-50/60 ring-transparent"
              } ${side === "right" ? "sm:ml-6" : ""}`}
            >
              {shown ? (
                <>
                  {shown.year ? (
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-amber-600">
                      {shown.year}
                    </p>
                  ) : null}
                  <p className="font-display text-lg font-semibold text-slate-800 sm:text-xl">
                    {shown.label}
                  </p>
                </>
              ) : (
                <p className="font-extrabold text-violet-400">Drop event {index + 1}</p>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function TimelineBuild({
  game,
  onChange,
}: {
  game: TimelineContent;
  onChange: (game: TimelineContent) => void;
}) {
  const [editing, setEditing] = useState(0);
  const current = game.items[editing];

  function updateItem(index: number, patch: Partial<TimelineItem>) {
    const items = game.items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange({ ...game, items });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-500">
        Oldest at the top. Tap a stop to edit it. This is the real timeline students will play.
      </p>
      <TimelineRail
        items={game.items}
        filled
        onEdit={setEditing}
      />
      {current ? (
        <div className="space-y-3 rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-500">
            Stop {editing + 1}
          </p>
          <label className="block text-xs font-extrabold text-slate-500">
            Year or marker
            <input
              value={current.year ?? ""}
              onChange={(e) => updateItem(editing, { year: e.target.value || undefined })}
              className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-base font-bold text-slate-800"
            />
          </label>
          <label className="block text-xs font-extrabold text-slate-500">
            What happened
            <input
              value={current.label}
              onChange={(e) => updateItem(editing, { label: e.target.value })}
              className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-base font-bold text-slate-800"
            />
          </label>
          <label className="block text-xs font-extrabold text-slate-500">
            Why (shown on a miss)
            <textarea
              value={current.why ?? ""}
              onChange={(e) => updateItem(editing, { why: e.target.value || undefined })}
              rows={2}
              className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={editing === 0}
              onClick={() => {
                if (editing === 0) return;
                const items = [...game.items];
                [items[editing - 1], items[editing]] = [items[editing]!, items[editing - 1]!];
                onChange({ ...game, items });
                setEditing(editing - 1);
              }}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 disabled:opacity-40"
            >
              Move up
            </button>
            <button
              type="button"
              disabled={editing === game.items.length - 1}
              onClick={() => {
                if (editing >= game.items.length - 1) return;
                const items = [...game.items];
                [items[editing + 1], items[editing]] = [items[editing]!, items[editing + 1]!];
                onChange({ ...game, items });
                setEditing(editing + 1);
              }}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 disabled:opacity-40"
            >
              Move down
            </button>
            <button
              type="button"
              disabled={game.items.length <= 2}
              onClick={() => {
                const items = game.items.filter((_, i) => i !== editing);
                onChange({ ...game, items });
                setEditing(Math.max(0, editing - 1));
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 disabled:opacity-40"
            >
              <Trash2 className="size-3.5" strokeWidth={2.5} />
              Remove
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          const id = `event-${Date.now()}`;
          onChange({
            ...game,
            items: [...game.items, { id, label: "New event" }],
          });
          setEditing(game.items.length);
        }}
        className="inline-flex items-center gap-2 text-sm font-extrabold text-violet-700"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Add event
      </button>
    </div>
  );
}
