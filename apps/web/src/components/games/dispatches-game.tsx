"use client";

import type { DispatchesGame as DispatchesContent } from "@jose/shared";
import { useMemo, useRef, useState } from "react";
import { GameBoard } from "./game-board";
import { dispatchNextOptions, nextDispatchStop } from "./advanced-play";
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
  const [routePicked, setRoutePicked] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState<string | null>(null);
  const [pickedStopId, setPickedStopId] = useState<string | null>(null);
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
  const next = active ? nextDispatchStop(game, active.id) : null;
  const options = active ? dispatchNextOptions(game, active.id) : [];

  async function pickNext(stopId: string) {
    if (!active || disabled || routePicked || pickedStopId) return;
    if (next && stopId === next.id) {
      setPickedStopId(stopId);
      setRoutePicked(true);
      setRouteFeedback(`${next.name} is the next stop.`);
      return;
    }
    missesRef.current += 1;
    setPickedStopId(stopId);
    setRouteFeedback(
      next
        ? `He went to ${next.name} next. ${next.contextCard}`
        : "That was not the next stop.",
    );
    await onMiss({
      title: "Next stop",
      body: next
        ? `He went to ${next.name} next. ${next.contextCard}`
        : "That was not the next stop on this route.",
    });
  }

  async function choose(choiceId: string) {
    if (!active || disabled || cleared[active.id]) return;
    const choice = active.dispatchChoices.find((item) => item.id === choiceId);
    if (!choice) return;
    if (choice.teachesObjective) {
      const nextCleared = { ...cleared, [active.id]: true as const };
      setCleared(nextCleared);
      const finished = game.stops.every((stop) => nextCleared[stop.id]);
      if (finished) {
        onFinish(game.stops.length - missesRef.current, game.stops.length, missesRef.current, {
          type: "dispatches",
          completed: true,
        });
      } else {
        const nextStop = game.stops.find((stop) => !nextCleared[stop.id]);
        if (nextStop) setActiveId(nextStop.id);
      }
      return;
    }
    missesRef.current += 1;
    await onMiss({ title: "Dispatch feedback", body: choice.why });
  }

  const showRoute = Boolean(active && !routePicked && !cleared[active.id] && next);

  return (
    <GameBoard
      scene="dispatches"
      step={showRoute ? "Choose the next stop" : "Read the dispatch"}
    >
      <div className="space-y-4">
        {game.approvalStatus === "draft" ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 ring-1 ring-amber-200">
            Draft route — replace excerpts before publish. Map is schematic only.
          </p>
        ) : null}
        <div className="rounded-[1.5rem] bg-sky-900 px-4 py-4 text-sky-50">
          <p className="font-display text-2xl font-semibold">{game.routeTitle}</p>
          <p className="mt-1 text-sm font-semibold text-sky-100">
            Follow Rizal’s route. Tap the place that comes next.
          </p>
        </div>

        {active ? (
          <section className="rounded-[1.4rem] bg-[var(--jose-surface-elevated)] px-4 py-4 ring-1 ring-[var(--jose-rule)]">
            <p className="text-xs font-extrabold uppercase tracking-wide text-sky-800">
              Current stop
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-[var(--jose-text)]">
              {active.name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-[var(--jose-text)]">
              {active.contextCard}
            </p>
          </section>
        ) : null}

        {showRoute ? (
          <section className="space-y-3">
            <p className="text-sm font-extrabold text-[var(--jose-text)]">
              Where did he go next?
            </p>
            <p className="text-sm font-semibold text-[var(--jose-text-muted)]">
              Choose the next stop
            </p>
            <ul className="grid gap-3" aria-label="Possible next stops">
              {options.map((stop) => {
                const selected = pickedStopId === stop.id;
                const correct = Boolean(next && stop.id === next.id && pickedStopId);
                const tone = !pickedStopId
                  ? "bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-[var(--jose-rule)]"
                  : correct
                    ? "bg-emerald-700 text-white ring-emerald-800"
                    : selected
                      ? "bg-rose-800 text-white ring-rose-900"
                      : "bg-[var(--jose-surface-control)] text-[var(--jose-text-muted)] ring-[var(--jose-rule)]";
                return (
                  <li key={stop.id}>
                    <button
                      type="button"
                      disabled={disabled || Boolean(pickedStopId)}
                      onClick={() => void pickNext(stop.id)}
                      className={`w-full rounded-[1.3rem] px-4 py-4 text-left ring-2 disabled:opacity-100 ${tone}`}
                    >
                      <span className="block text-xs font-extrabold uppercase tracking-wide opacity-80">
                        {stop.regionLabel}
                      </span>
                      <span className="font-display text-lg font-semibold">{stop.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {routeFeedback ? (
              <p className="text-sm font-semibold text-[var(--jose-text)]" aria-live="polite">
                {routeFeedback}
              </p>
            ) : null}
            {pickedStopId && !routePicked ? (
              <button
                type="button"
                onClick={() => setRoutePicked(true)}
                className="min-h-11 w-full rounded-full bg-sky-800 px-4 py-3 text-sm font-extrabold text-white"
              >
                Continue the route
              </button>
            ) : null}
          </section>
        ) : null}

        {active && unlockedIds.has(active.id) && (routePicked || !next || Boolean(cleared[active.id])) ? (
          <section className="space-y-3 rounded-[1.5rem] bg-[var(--jose-surface-elevated)] p-4 ring-1 ring-[var(--jose-rule)]">
            <p className="text-xs font-extrabold uppercase tracking-wide text-sky-800">
              Read the dispatch
            </p>
            <h3 className="font-display text-xl font-semibold text-[var(--jose-text)]">
              {active.name}
            </h3>
            <blockquote className="rounded-2xl bg-[var(--jose-surface-control)] px-3 py-3 text-sm font-semibold text-[var(--jose-text)]">
              <p>{active.sourceExcerpt}</p>
              <footer className="mt-2 text-xs font-bold text-[var(--jose-text-muted)]">
                {active.sourceCitation}
              </footer>
            </blockquote>
            <p className="text-sm font-extrabold text-sky-900">{active.prompt}</p>
            <ul className="space-y-2">
              {active.dispatchChoices.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    disabled={disabled || Boolean(cleared[active.id])}
                    onClick={() => void choose(choice.id)}
                    className="w-full rounded-2xl bg-sky-800 px-4 py-3 text-left text-sm font-extrabold text-white disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)]"
                  >
                    {choice.label}
                  </button>
                </li>
              ))}
            </ul>
            {cleared[active.id] && !allDone ? (
              <p className="text-sm font-extrabold text-teal-800">Continue the route</p>
            ) : null}
          </section>
        ) : null}

        {allDone ? (
          <p className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-950 ring-1 ring-emerald-200">
            {game.debrief}
          </p>
        ) : null}
      </div>
    </GameBoard>
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
