"use client";

import type { DispatchesGame as DispatchesContent } from "@jose/shared";
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { PlayBoardProps } from "./play-types";

export function DispatchesGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: DispatchesContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: DispatchesContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <DispatchesBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <DispatchesPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
    />
  );
}

function DispatchesPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: DispatchesContent } & PlayBoardProps) {
  const [cleared, setCleared] = useState<Record<string, true>>({});
  const [activeId, setActiveId] = useState(game.stops[0]?.id ?? null);
  const [view, setView] = useState<"list" | "map">("list");
  const missesRef = useRef(0);

  const unlockedIds = useMemo(() => {
    const unlocked = new Set<string>();
    for (const stop of game.stops) {
      const ready = stop.unlockAfterIds.every((id) => cleared[id]);
      if (ready) unlocked.add(stop.id);
    }
    return unlocked;
  }, [game.stops, cleared]);

  const active = game.stops.find((stop) => stop.id === activeId) ?? null;
  const allDone = game.stops.every((stop) => cleared[stop.id]);

  async function choose(choiceId: string) {
    if (!active || disabled || cleared[active.id]) return;
    const choice = active.dispatchChoices.find((item) => item.id === choiceId);
    if (!choice) return;
    if (choice.teachesObjective) {
      const next = { ...cleared, [active.id]: true as const };
      setCleared(next);
      const finished = game.stops.every((stop) => next[stop.id]);
      if (finished) {
        onFinish(game.stops.length - missesRef.current, game.stops.length, missesRef.current);
      } else {
        const nextStop = game.stops.find((stop) => !next[stop.id]);
        if (nextStop) setActiveId(nextStop.id);
      }
      return;
    }
    missesRef.current += 1;
    await onMiss({ title: "Dispatch feedback", body: choice.why });
  }

  return (
    <div className="space-y-4">
      {game.approvalStatus === "draft" ? (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 ring-1 ring-amber-200">
          Draft route — replace excerpts before publish. Map is schematic only.
        </p>
      ) : null}
      <div className="rounded-[1.5rem] bg-sky-900 px-4 py-4 text-white">
        <p className="font-display text-2xl font-semibold">{game.routeTitle}</p>
        <p className="mt-1 text-sm font-semibold text-sky-100">{game.mapCaption}</p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Dispatch navigation">
        <TabButton active={view === "list"} onClick={() => setView("list")}>
          Place list
        </TabButton>
        <TabButton active={view === "map"} onClick={() => setView("map")}>
          Schematic map
        </TabButton>
      </div>

      {view === "map" ? (
        <svg
          viewBox="0 0 100 70"
          role="img"
          aria-label="Schematic Europe route. Equivalent place list is also available."
          className="w-full rounded-[1.4rem] bg-gradient-to-br from-sky-100 to-emerald-50 ring-1 ring-black/10"
        >
          <title>Schematic route map</title>
          {game.stops.map((stop) => {
            const unlocked = unlockedIds.has(stop.id);
            const done = Boolean(cleared[stop.id]);
            return (
              <g key={stop.id}>
                <circle
                  cx={stop.x}
                  cy={stop.y}
                  r={done ? 4.5 : 3.8}
                  className={
                    done
                      ? "fill-emerald-500"
                      : unlocked
                        ? "fill-sky-600"
                        : "fill-slate-400"
                  }
                />
                <text
                  x={stop.x}
                  y={Math.max(6, stop.y - 5)}
                  textAnchor="middle"
                  className="fill-slate-700 text-[4px] font-bold"
                >
                  {stop.name}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}

      <ul className="space-y-2" aria-label="Stops">
        {game.stops.map((stop) => {
          const unlocked = unlockedIds.has(stop.id);
          const done = Boolean(cleared[stop.id]);
          return (
            <li key={stop.id}>
              <button
                type="button"
                disabled={!unlocked || disabled}
                onClick={() => setActiveId(stop.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left ring-2 ${
                  activeId === stop.id
                    ? "bg-sky-50 ring-sky-400"
                    : "bg-white ring-black/10"
                } ${!unlocked ? "opacity-50" : ""}`}
              >
                <span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                  {stop.regionLabel}
                  {done ? " · cleared" : unlocked ? "" : " · locked"}
                </span>
                <span className="text-sm font-extrabold text-slate-800">
                  {stop.name}
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  {stop.objective}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {active && unlockedIds.has(active.id) ? (
        <section className="space-y-3 rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
          <h3 className="font-display text-xl font-semibold text-slate-900">
            {active.name}
          </h3>
          <p className="text-sm font-semibold text-slate-700">{active.contextCard}</p>
          <blockquote className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 ring-1 ring-black/5">
            <p>{active.sourceExcerpt}</p>
            <footer className="mt-2 text-xs font-bold text-slate-500">
              {active.sourceCitation}
            </footer>
          </blockquote>
          <p className="text-sm font-bold text-slate-800">{active.encounter}</p>
          <p className="text-sm font-extrabold text-sky-800">{active.prompt}</p>
          <ul className="space-y-2">
            {active.dispatchChoices.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  disabled={disabled || Boolean(cleared[active.id])}
                  onClick={() => void choose(choice.id)}
                  className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-left text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {choice.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {allDone ? (
        <p className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-950 ring-1 ring-emerald-200">
          {game.debrief}
        </p>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-extrabold ${
        active ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function DispatchesBuild({
  game,
  onChange,
}: {
  game: DispatchesContent;
  onChange: (game: DispatchesContent) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
        {game.teacherInstructions}
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Route title
        </span>
        <input
          value={game.routeTitle}
          onChange={(e) => onChange({ ...game, routeTitle: e.target.value })}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Map caption
        </span>
        <textarea
          value={game.mapCaption}
          onChange={(e) => onChange({ ...game, mapCaption: e.target.value })}
          rows={2}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Stops JSON (author x/y 0–100, unlockAfterIds, excerpts)
        </span>
        <textarea
          value={JSON.stringify(game.stops, null, 2)}
          onChange={(e) => {
            try {
              onChange({
                ...game,
                stops: JSON.parse(e.target.value) as DispatchesContent["stops"],
              });
            } catch {
              /* keep typing */
            }
          }}
          rows={16}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Debrief
        </span>
        <textarea
          value={game.debrief}
          onChange={(e) => onChange({ ...game, debrief: e.target.value })}
          rows={3}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
    </div>
  );
}
