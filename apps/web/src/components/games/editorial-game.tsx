"use client";

import {
  gradeEditorial,
  type EditorialGame as EditorialContent,
} from "@jose/shared";
import { useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";
import { PlaceGhost, usePlaceDrag } from "./use-place-drag";

export function EditorialGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: EditorialContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: EditorialContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <EditorialBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <EditorialPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
    />
  );
}

function EditorialPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: EditorialContent } & PlayBoardProps) {
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const missesRef = useRef(0);
  const drag = usePlaceDrag({
    disabled: disabled || done,
    dropSelector: "[data-editorial-slot]",
    allowDrag: true,
    onDrop: (pieceId, target) => {
      const slotId = target.dataset.editorialSlot;
      if (!slotId) return;
      place(slotId, pieceId);
    },
  });

  function place(slotId: string, pieceId = drag.selectedRef.current) {
    if (!pieceId || disabled || done) return;
    const piece = game.pieces.find((item) => item.id === pieceId);
    const slot = game.slots.find((item) => item.id === slotId);
    if (!piece || !slot || piece.role !== slot.role) return;
    setPlacement((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(next)) {
        if (value === pieceId) delete next[key];
      }
      next[slotId] = pieceId;
      return next;
    });
    drag.select(null);
  }

  function returnPiece(pieceId: string) {
    if (disabled || done) return;
    setPlacement((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(next)) {
        if (value === pieceId) delete next[key];
      }
      return next;
    });
    drag.select(null);
  }

  async function check() {
    if (disabled || done) return;
    const result = gradeEditorial(game, placement);
    setPreview(result.feedback);
    if (result.ok) {
      setDone(true);
      onFinish(result.score, result.maxScore, missesRef.current);
      return;
    }
    missesRef.current += 1;
    for (const weakId of result.weakPieceIds) {
      returnPiece(weakId);
    }
    await onMiss({ title: "Editorial feedback", body: result.feedback });
  }

  const used = new Set(Object.values(placement));
  const leftover = game.pieces.filter((piece) => !used.has(piece.id));
  const filled = game.slots.every((slot) => placement[slot.id]);

  return (
    <div className="space-y-4">
      <PlaceGhost ghost={drag.ghost} />
      {game.approvalStatus === "draft" ? (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 ring-1 ring-amber-200">
          Draft editorial — approve briefing and pieces before publish.
        </p>
      ) : null}
      <div className="rounded-[1.5rem] bg-orange-950 px-4 py-4 text-orange-50">
        <p className="text-xs font-extrabold uppercase tracking-wide text-orange-300">
          Historical briefing
        </p>
        <p className="mt-1 text-sm font-semibold leading-relaxed">{game.briefing}</p>
      </div>
      <p className="text-xs font-bold text-slate-600">{game.scoringPreview}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {game.slots.map((slot) => {
          const pieceId = placement[slot.id];
          const piece = game.pieces.find((item) => item.id === pieceId);
          return (
            <div
              key={slot.id}
              data-editorial-slot={slot.id}
              className="min-h-28 rounded-[1.4rem] bg-white p-3 ring-2 ring-black/10"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {slot.label} · {slot.role}
              </p>
              {piece ? (
                <button
                  type="button"
                  disabled={disabled || done}
                  onClick={() => returnPiece(piece.id)}
                  className="mt-2 w-full rounded-2xl bg-orange-50 px-3 py-3 text-left text-sm font-bold text-orange-950"
                >
                  {piece.text}
                </button>
              ) : (
                <p className="mt-3 text-sm font-semibold text-slate-400">
                  Drop a {slot.role} here
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Argument pieces">
        {leftover.map((piece) => {
          const selected = drag.selected === piece.id;
          return (
            <button
              key={piece.id}
              type="button"
              disabled={disabled || done}
              data-place-item={piece.id}
              onPointerDown={(e) => drag.onPointerDown(e, piece.id, piece.text)}
              onPointerMove={drag.onPointerMove}
              onPointerUp={drag.onPointerUp}
              onPointerCancel={drag.onPointerCancel}
              onClick={() => {
                if (drag.consumeClick()) return;
                drag.select(selected ? null : piece.id);
              }}
              className={`max-w-full rounded-2xl px-3 py-2 text-left text-sm font-bold ring-2 ${
                selected
                  ? "bg-orange-200 ring-orange-500"
                  : "bg-white ring-black/10"
              }`}
            >
              <span className="block text-[10px] uppercase text-slate-500">
                {piece.role}
              </span>
              {piece.text}
            </button>
          );
        })}
      </div>

      {drag.selected ? (
        <div className="flex flex-wrap gap-2 sm:hidden">
          {game.slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className="rounded-full bg-slate-800 px-3 py-2 text-xs font-extrabold text-white"
              onClick={() => place(slot.id)}
            >
              Put in {slot.label}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!filled || disabled || done}
        onClick={() => void check()}
        className="w-full rounded-full bg-orange-600 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        Check editorial
      </button>
      {preview ? (
        <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
          {preview}
        </p>
      ) : null}
    </div>
  );
}

function EditorialBuild({
  game,
  onChange,
}: {
  game: EditorialContent;
  onChange: (game: EditorialContent) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
        {game.teacherInstructions}
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Briefing
        </span>
        <textarea
          value={game.briefing}
          onChange={(e) => onChange({ ...game, briefing: e.target.value })}
          rows={4}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Pieces JSON
        </span>
        <textarea
          value={JSON.stringify(game.pieces, null, 2)}
          onChange={(e) => {
            try {
              onChange({
                ...game,
                pieces: JSON.parse(e.target.value) as EditorialContent["pieces"],
              });
            } catch {
              /* keep typing */
            }
          }}
          rows={12}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Accepted structures JSON (2+ structures)
        </span>
        <textarea
          value={JSON.stringify(game.acceptedStructures, null, 2)}
          onChange={(e) => {
            try {
              onChange({
                ...game,
                acceptedStructures: JSON.parse(
                  e.target.value,
                ) as EditorialContent["acceptedStructures"],
              });
            } catch {
              /* keep typing */
            }
          }}
          rows={6}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Scoring preview
        </span>
        <textarea
          value={game.scoringPreview}
          onChange={(e) => onChange({ ...game, scoringPreview: e.target.value })}
          rows={2}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
    </div>
  );
}
