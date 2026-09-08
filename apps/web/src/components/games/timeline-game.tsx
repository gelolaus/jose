"use client";

import type {
  AssessmentTimeline,
  TimelineGame as TimelineContent,
  TimelineItem,
} from "@jose/shared";
import { shuffledCopy } from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import type { PlayBoardProps } from "./play-types";
import {
  allStopsFilled,
  formatTimelineWhy,
  gradeCausalChoice,
  gradeTimelineCheck,
} from "./timeline-grade";
import { PlaceGhost, usePlaceDrag } from "./use-place-drag";
import { GameBoard } from "./game-board";

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

function slotOf(placed: Record<number, string>, itemId: string): number | null {
  for (const [slot, id] of Object.entries(placed)) {
    if (id === itemId) return Number(slot);
  }
  return null;
}

function yearLabel(
  item: TimelineItem,
  index: number,
  hints: { mode: "always" | "optional" | "hidden"; revealed: boolean },
) {
  if (hints.mode === "hidden") return `Stop ${index + 1}`;
  if (hints.mode === "optional" && !hints.revealed) return `Stop ${index + 1}`;
  return item.year?.trim() || `Stop ${index + 1}`;
}

function dealTimelineItems(items: TimelineItem[]) {
  const copy = shuffledCopy(items);
  if (copy.length > 1 && copy.every((item, i) => item.id === items[i]?.id)) {
    [copy[0], copy[1]] = [copy[1]!, copy[0]!];
  }
  return copy;
}

function StopShell({ className = "sm:w-44", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`relative grid grid-cols-[1.75rem_minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)] items-start gap-x-3 sm:flex sm:shrink-0 sm:flex-col sm:items-center ${className}`}
    >
      {children}
    </div>
  );
}

function StopBead({
  index,
  tone,
  onClick,
}: {
  index: number;
  tone: "empty" | "filled" | "locked" | "selected";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "locked"
      ? "border-emerald-700 bg-emerald-600 text-white"
      : tone === "empty"
        ? "border-violet-700 bg-white text-violet-700"
        : "border-violet-800 bg-violet-700 text-white";
  const beadClass = `relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border-[3px] text-[11px] font-extrabold shadow-[0_2px_0_#4c1d95] ${toneClass}`;
  return (
    <div className="relative z-[1] col-start-1 row-start-1 row-span-3 mt-5 flex justify-center self-start sm:mt-0 sm:w-full">
      <span
        aria-hidden
        className="pointer-events-none absolute top-[-14px] bottom-[-14px] left-1/2 w-2 -translate-x-1/2 rounded-full bg-[#f5c518] shadow-[3px_0_0_#d97706] sm:top-1/2 sm:right-[-0.5rem] sm:bottom-auto sm:left-[-0.5rem] sm:h-2 sm:w-auto sm:translate-x-0 sm:-translate-y-1/2 sm:shadow-[0_3px_0_#d97706]"
      />
      {onClick ? (
        <button type="button" onClick={onClick} className={beadClass}>
          {index + 1}
        </button>
      ) : (
        <span className={beadClass}>{index + 1}</span>
      )}
    </div>
  );
}

const YEAR_PILL =
  "col-start-2 row-start-1 mb-1 flex min-h-[2.35rem] w-full items-center justify-center rounded-full bg-[#f5c518] px-2.5 py-1 text-center text-[11px] font-extrabold leading-snug text-slate-800 shadow-[0_3px_0_#d97706] sm:mb-2";

function StopStem() {
  return <span aria-hidden className="col-start-2 row-start-2 mx-auto mb-1 block h-3 w-0.5 rounded-full bg-amber-700" />;
}

type TimelinePlayContent = TimelineContent | AssessmentTimeline;

function playItems(game: TimelinePlayContent): TimelineItem[] {
  return game.items as TimelineItem[];
}

export function TimelineGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onEvaluate,
  onChange,
}: {
  game: TimelinePlayContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: TimelineContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange && "causalLink" in game) {
    return <TimelineBuild game={game as TimelineContent} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <TimelinePlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
      onEvaluate={onEvaluate}
    />
  );
}

function TimelinePlay({
  game,
  disabled,
  onMiss,
  onFinish,
  onEvaluate,
}: { game: TimelinePlayContent } & PlayBoardProps) {
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [locked, setLocked] = useState<Record<string, true>>({});
  const [shake, setShake] = useState(false);
  const [bank, setBank] = useState(game.items);
  const [phase, setPhase] = useState<"timeline" | "causal" | "causal-explanation">("timeline");
  const [hintsRevealed, setHintsRevealed] = useState(false);
  const missesRef = useRef(0);
  const causalChoiceRef = useRef<string | undefined>(undefined);
  const maxPieces = game.items.length + (game.causalLink ? 1 : 0);
  const { feedbackHoldMs, playCue } = useMotionSound();
  const wide = useWideScreen();
  const drag = usePlaceDrag({
    disabled,
    dropSelector: "[data-timeline-slot]",
    allowDrag: wide,
    onDrop: (itemId, target) => {
      const slot = Number(target.dataset.timelineSlot);
      if (!Number.isInteger(slot)) return;
      putOn(slot, itemId);
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBank(dealTimelineItems(game.items as TimelineItem[]));
      setPlaced({});
      setLocked({});
      setPhase("timeline");
      setHintsRevealed(false);
      missesRef.current = 0;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game.items, game.causalLink, game.dateHints]);

  const currentOrder = useCallback(
    () => game.items.map((_, index) => placed[index]!).filter(Boolean),
    [game.items, placed],
  );

  const finishTimeline = useCallback(() => {
    onFinish(maxPieces - missesRef.current, maxPieces, missesRef.current, {
      type: "timeline",
      order: currentOrder(),
      causalChoiceId: causalChoiceRef.current,
    });
  }, [currentOrder, maxPieces, onFinish]);

  useEffect(() => {
    if (phase !== "causal-explanation") return;
    const timer = window.setTimeout(() => {
      finishTimeline();
    }, feedbackHoldMs);
    return () => window.clearTimeout(timer);
  }, [feedbackHoldMs, finishTimeline, phase]);

  function putOn(slot: number, itemId = drag.selectedRef.current) {
    if (!itemId || disabled || locked[itemId]) return;
    if (!game.items.some((item) => item.id === itemId)) return;
    const occupant = placed[slot];
    if (occupant && occupant !== itemId) return;
    setPlaced((prev) => {
      const next = { ...prev };
      const old = slotOf(next, itemId);
      if (old !== null) delete next[old];
      next[slot] = itemId;
      return next;
    });
    drag.select(null);
  }

  function returnItem(itemId: string) {
    if (disabled || locked[itemId]) return;
    setPlaced((prev) => {
      const next = { ...prev };
      const old = slotOf(next, itemId);
      if (old !== null) delete next[old];
      return next;
    });
    drag.select(null);
  }

  async function check() {
    if (disabled || !allStopsFilled(playItems(game), placed)) return;
    const order = currentOrder();
    if (onEvaluate) {
      const result = await onEvaluate({ type: "timeline_check", order });
      if (result.perfect) {
        const all: Record<string, true> = {};
        for (const item of game.items) all[item.id] = true;
        setLocked(all);
        playCue("accept");
        if (game.causalLink) {
          setPhase("causal");
          return;
        }
        finishTimeline();
        return;
      }
      missesRef.current += 1;
      playCue("reject");
      const nextLocked: Record<string, true> = { ...locked };
      for (const id of result.correctIds ?? []) nextLocked[id] = true;
      const nextPlaced = { ...placed };
      for (const item of game.items) {
        if (nextLocked[item.id]) continue;
        const slot = slotOf(nextPlaced, item.id);
        if (slot !== null) delete nextPlaced[slot];
      }
      setPlaced(nextPlaced);
      setLocked(nextLocked);
      drag.select(null);
      setShake(true);
      window.setTimeout(() => setShake(false), 550);
      await onMiss(result.feedback ?? null);
      return;
    }
    const result = gradeTimelineCheck(playItems(game), placed);
    if (result.perfect) {
      const all: Record<string, true> = {};
      for (const item of game.items) all[item.id] = true;
      setLocked(all);
      playCue("accept");
      if (game.causalLink) {
        setPhase("causal");
        return;
      }
      finishTimeline();
      return;
    }
    missesRef.current += 1;
    playCue("reject");
    const nextPlaced = { ...placed };
    const nextLocked: Record<string, true> = { ...locked };
    for (const id of result.correctIds) nextLocked[id] = true;
    for (const item of result.wrongItems) {
      const slot = slotOf(nextPlaced, item.id);
      if (slot !== null) delete nextPlaced[slot];
    }
    setPlaced(nextPlaced);
    setLocked(nextLocked);
    drag.select(null);
    setShake(true);
    window.setTimeout(() => setShake(false), 550);
    await onMiss(formatTimelineWhy(result.wrongItems));
  }

  async function answerCausal(choiceId: string) {
    if (disabled || !game.causalLink) return;
    causalChoiceRef.current = choiceId;
    if (onEvaluate) {
      const result = await onEvaluate({ type: "timeline_causal", choiceId });
      if (!result.correct) {
        missesRef.current += 1;
        playCue("reject");
        await onMiss(
          result.feedback
            ? { title: result.feedback.title, body: result.feedback.body, tone: "miss" }
            : { title: "Not quite", body: "Try the causal connection again.", tone: "miss" },
        );
        return;
      }
      playCue("accept");
      setPhase("causal-explanation");
      return;
    }
    const result = gradeCausalChoice(game as TimelineContent, choiceId);
    if (!result.perfect) {
      missesRef.current += 1;
      playCue("reject");
      await onMiss({
        title: "Not quite",
        body: result.explanation ?? "Try the causal connection again.",
        tone: "miss",
      });
      return;
    }
    playCue("accept");
    setPhase("causal-explanation");
  }

  const leftover = bank.filter((item) => !Object.values(placed).includes(item.id));
  const hoverSlot =
    drag.overEl?.dataset.timelineSlot !== undefined
      ? Number(drag.overEl.dataset.timelineSlot)
      : null;
  const canCheck = allStopsFilled(playItems(game), placed);

  if (phase !== "timeline" && game.causalLink) {
    return (
      <GameBoard scene="timeline" step="Explain the connection">
        <CausalChallenge
          link={game.causalLink as NonNullable<TimelineContent["causalLink"]>}
          showingExplanation={phase === "causal-explanation"}
          disabled={disabled}
          onChoose={answerCausal}
        />
      </GameBoard>
    );
  }

  return (
    <GameBoard scene="timeline" step="Place the events">
    <div className={`flex flex-col gap-4 pb-28 sm:gap-5 sm:pb-0 ${shake ? "snap-back" : ""}`}>
      <PlaceGhost ghost={drag.ghost} />
      <TimelineRail
        items={game.items}
        placed={placed}
        locked={locked}
        selectedId={drag.selected}
        hoverSlot={hoverSlot}
        disabled={disabled}
        hints={{ mode: game.dateHints ?? "always", revealed: hintsRevealed }}
        onEmptyStop={(slot) => putOn(slot)}
        onPlacedCard={(itemId) => {
          if (drag.selected === itemId) {
            returnItem(itemId);
            return;
          }
          drag.select(itemId);
        }}
      />
      {game.dateHints === "optional" ? (
        <div className="flex items-center gap-3">
          {!hintsRevealed ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setHintsRevealed(true)}
              className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-extrabold text-amber-900"
            >
              Show date hints
            </button>
          ) : (
            <p className="text-xs font-bold text-amber-800">Date hints used</p>
          )}
        </div>
      ) : null}
      <div className="z-20 -mx-4 border-t border-amber-200/70 bg-[var(--jose-cream)] px-4 py-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        {leftover.length > 0 ? (
          <>
            <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 sm:hidden">
              Events
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
                    className={`min-h-12 shrink-0 touch-manipulation select-none whitespace-nowrap rounded-full px-4 text-sm font-extrabold ring-2 ${
                      lifting
                        ? "cursor-grabbing bg-violet-100 text-violet-400 opacity-40 ring-violet-200"
                        : on
                          ? "cursor-grab bg-violet-700 text-white ring-violet-900"
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
          className="w-full rounded-full bg-violet-600 px-5 py-3 text-base font-extrabold text-white shadow-md disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)] sm:ml-auto sm:block sm:w-auto sm:px-8"
        >
          Check
        </button>
      </div>
    </div>
    </GameBoard>
  );
}

function CausalChallenge({
  link,
  showingExplanation,
  disabled,
  onChoose,
}: {
  link: NonNullable<TimelineContent["causalLink"]>;
  showingExplanation: boolean;
  disabled: boolean;
  onChoose: (choiceId: string) => void;
}) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-[1.5rem] border-2 border-amber-200 bg-amber-50 p-5 shadow-[0_4px_0_#fde68a]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700">
        Cause and consequence
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-slate-800">{link.prompt}</h2>
      {showingExplanation ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-relaxed text-emerald-900">
          {link.explanation}
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {link.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              disabled={disabled}
              onClick={() => void onChoose(choice.id)}
              className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-extrabold text-slate-800 ring-2 ring-amber-200 transition hover:ring-violet-400 disabled:opacity-50"
            >
              {choice.text}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TimelineRail({
  items,
  placed,
  locked,
  selectedId,
  hoverSlot,
  disabled,
  hints,
  onEmptyStop,
  onPlacedCard,
}: {
  items: TimelineItem[];
  placed: Record<number, string>;
  locked: Record<string, true>;
  selectedId: string | null;
  hoverSlot: number | null;
  disabled: boolean;
  hints: { mode: "always" | "optional" | "hidden"; revealed: boolean };
  onEmptyStop: (slot: number) => void;
  onPlacedCard: (itemId: string) => void;
}) {
  return (
    <div className="sm:overflow-x-auto sm:pb-2">
      <div className="relative flex flex-col gap-5 pl-1 sm:min-w-min sm:flex-row sm:gap-4 sm:px-1 sm:pr-8">
        {items.map((stop, index) => {
          const placedId = placed[index];
          const shown = placedId ? items.find((item) => item.id === placedId) : undefined;
          const isLocked = Boolean(shown && locked[shown.id]);
          const hot = !shown && (hoverSlot === index || Boolean(selectedId));
          return (
            <StopShell key={stop.id}>
              <p className={YEAR_PILL}>{yearLabel(stop, index, hints)}</p>
              <StopBead index={index} tone={isLocked ? "locked" : shown ? "filled" : "empty"} />
              <StopStem />
              <div className="col-start-2 row-start-3 min-w-0 w-full">
                {shown ? (
                  isLocked ? (
                    <div className="min-h-[4.5rem] w-full rounded-[1.05rem] border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 text-left text-sm font-extrabold leading-snug text-emerald-900 shadow-[0_4px_0_#a7f3d0]">
                      {shown.label}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Pick up ${shown.label}`}
                      onClick={() => onPlacedCard(shown.id)}
                      className={`min-h-[4.5rem] w-full rounded-[1.05rem] px-3 py-2.5 text-left text-sm font-extrabold leading-snug ring-2 ${
                        selectedId === shown.id
                          ? "bg-violet-600 text-white ring-violet-700"
                          : "bg-white text-slate-800 shadow-[0_4px_0_#ddd6fe] ring-violet-200"
                      }`}
                    >
                      {shown.label}
                    </button>
                  )
                ) : (
                  <EmptyWell
                    index={index}
                    hot={hot}
                    disabled={disabled}
                    onChoose={() => onEmptyStop(index)}
                  />
                )}
              </div>
            </StopShell>
          );
        })}
      </div>
    </div>
  );
}

function EmptyWell({
  index,
  hot,
  disabled,
  onChoose,
}: {
  index: number;
  hot: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChoose();
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Stop ${index + 1}`}
      data-timeline-slot={String(index)}
      onClick={() => {
        if (!disabled) onChoose();
      }}
      onKeyDown={onKeyDown}
      className={`flex min-h-[4.5rem] w-full items-center justify-center rounded-[1.05rem] text-[10px] font-extrabold uppercase tracking-wide ${
        hot
          ? "border-[3px] border-amber-400 bg-amber-50 text-amber-800 shadow-[0_0_0_4px_rgb(245_197_24/0.28)]"
          : "border-[2.5px] border-dashed border-violet-300 bg-violet-50 text-violet-500"
      }`}
    >
      Drop
    </div>
  );
}

function TimelineBuild({
  game,
  onChange,
}: {
  game: TimelineContent;
  onChange: (game: TimelineContent) => void;
}) {
  const [selected, setSelected] = useState(0);

  function patch(index: number, next: Partial<TimelineItem>) {
    onChange({
      ...game,
      items: game.items.map((item, i) => (i === index ? { ...item, ...next } : item)),
    });
  }

  function patchCausal(next: Partial<NonNullable<TimelineContent["causalLink"]>>) {
    if (!game.causalLink) return;
    onChange({ ...game, causalLink: { ...game.causalLink, ...next } });
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= game.items.length) return;
    const items = [...game.items];
    [items[index], items[next]] = [items[next]!, items[index]!];
    onChange({ ...game, items });
    setSelected(next);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Oldest first. Edit the date pill and the hanging card on the rail. Why sits under the card.
      </p>
      <label className="flex w-fit items-center gap-2 text-sm font-bold text-slate-700">
        Date hints
        <select
          value={game.dateHints ?? "always"}
          onChange={(e) =>
            onChange({
              ...game,
              dateHints: e.target.value as TimelineContent["dateHints"],
            })
          }
          className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-black/10"
        >
          <option value="always">Always show dates</option>
          <option value="optional">Let learners reveal dates</option>
          <option value="hidden">Hide dates</option>
        </select>
      </label>
      <div className="sm:overflow-x-auto sm:pb-2">
        <div className="relative flex flex-col gap-5 sm:min-w-min sm:flex-row sm:gap-4 sm:px-1 sm:pr-8">
          {game.items.map((item, index) => (
            <StopShell key={item.id} className="sm:w-48">
              <textarea
                aria-label={`Date for stop ${index + 1}`}
                maxLength={40}
                rows={2}
                value={item.year ?? ""}
                onChange={(e) => patch(index, { year: e.target.value.trim() ? e.target.value : undefined })}
                onFocus={() => setSelected(index)}
                placeholder={`Stop ${index + 1}`}
                className={`${YEAR_PILL} resize-none outline-none`}
              />
              <StopBead
                index={index}
                tone={selected === index ? "selected" : "empty"}
                onClick={() => setSelected(index)}
              />
              <StopStem />
              <div className="col-start-2 row-start-3 min-w-0 w-full">
                <textarea
                  aria-label={`Event for stop ${index + 1}`}
                  rows={3}
                  value={item.label}
                  onChange={(e) => patch(index, { label: e.target.value })}
                  onFocus={() => setSelected(index)}
                  className={`w-full resize-none rounded-[1.05rem] border-2 bg-white px-3 py-2 text-sm font-extrabold leading-snug text-slate-800 outline-none ${
                    selected === index ? "border-violet-600" : "border-violet-200"
                  }`}
                />
                <input
                  aria-label={`Why for stop ${index + 1}`}
                  placeholder="Why (on a miss)"
                  value={item.why ?? ""}
                  onChange={(e) => patch(index, { why: e.target.value.trim() ? e.target.value : undefined })}
                  onFocus={() => setSelected(index)}
                  className="mt-1 w-full rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 outline-none ring-1 ring-black/10"
                />
                <input
                  aria-label={`Chronology group for stop ${index + 1}`}
                  placeholder="Chronology group (optional)"
                  value={item.groupId ?? ""}
                  onChange={(e) =>
                    patch(index, { groupId: e.target.value.trim() ? e.target.value : undefined })
                  }
                  onFocus={() => setSelected(index)}
                  className="mt-1 w-full rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 outline-none ring-1 ring-black/10"
                />
              </div>
            </StopShell>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={selected === 0}
          onClick={() => move(selected, -1)}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 disabled:opacity-40"
        >
          <span className="sm:hidden">Move up</span>
          <span className="hidden sm:inline">Move left</span>
        </button>
        <button
          type="button"
          disabled={selected === game.items.length - 1}
          onClick={() => move(selected, 1)}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 disabled:opacity-40"
        >
          <span className="sm:hidden">Move down</span>
          <span className="hidden sm:inline">Move right</span>
        </button>
        <button
          type="button"
          disabled={game.items.length <= 2}
          onClick={() => {
            const items = game.items.filter((_, i) => i !== selected);
            onChange({ ...game, items });
            setSelected(Math.max(0, selected - 1));
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 disabled:opacity-40"
        >
          <Trash2 className="size-3.5" strokeWidth={2.5} />
          Remove
        </button>
        <button
          type="button"
          disabled={game.items.length >= 12}
          onClick={() => {
            onChange({
              ...game,
              items: [...game.items, { id: `event-${Date.now()}`, label: "New event" }],
            });
            setSelected(game.items.length);
          }}
          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700 disabled:opacity-40"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Add event
        </button>
      </div>
      {game.causalLink ? (
        <section className="space-y-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-slate-800">Cause and consequence</h3>
            <button
              type="button"
              onClick={() => onChange({ ...game, causalLink: undefined })}
              className="text-xs font-extrabold text-rose-700"
            >
              Remove question
            </button>
          </div>
          <textarea
            aria-label="Causal prompt"
            rows={2}
            value={game.causalLink.prompt}
            onChange={(e) => patchCausal({ prompt: e.target.value })}
            className="w-full resize-none rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-amber-200"
          />
          <div className="grid gap-2">
            {game.causalLink.choices.map((choice) => (
              <input
                key={choice.id}
                aria-label={`Causal choice ${choice.id}`}
                value={choice.text}
                onChange={(e) =>
                  patchCausal({
                    choices: game.causalLink!.choices.map((entry) =>
                      entry.id === choice.id ? { ...entry, text: e.target.value } : entry,
                    ),
                  })
                }
                className="w-full rounded-full bg-white px-3 py-2 text-sm font-semibold ring-1 ring-amber-200"
              />
            ))}
          </div>
          {game.causalLink.choices.length < 6 ? (
            <button
              type="button"
              onClick={() =>
                patchCausal({
                  choices: [
                    ...game.causalLink!.choices,
                    { id: `cause-${Date.now()}`, text: "New choice" },
                  ],
                })
              }
              className="text-xs font-extrabold text-violet-700"
            >
              + Add choice
            </button>
          ) : null}
          <label className="block text-xs font-bold text-slate-700">
            Correct choice
            <select
              value={game.causalLink.correctChoiceId}
              onChange={(e) => patchCausal({ correctChoiceId: e.target.value })}
              className="mt-1 block w-full rounded-full bg-white px-3 py-2 text-sm font-semibold ring-1 ring-amber-200"
            >
              {game.causalLink.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.text || "Untitled choice"}
                </option>
              ))}
            </select>
          </label>
          <textarea
            aria-label="Causal explanation"
            rows={3}
            value={game.causalLink.explanation}
            onChange={(e) => patchCausal({ explanation: e.target.value })}
            placeholder="Why this connection is correct"
            className="w-full resize-none rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-amber-200"
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            const firstChoiceId = `cause-${Date.now()}-1`;
            onChange({
              ...game,
              causalLink: {
                prompt: "What connects these events?",
                choices: [
                  { id: firstChoiceId, text: "The earlier event enabled the later one" },
                  { id: `${firstChoiceId}-alt`, text: "They are unrelated" },
                ],
                correctChoiceId: firstChoiceId,
                explanation: "Explain how one event shaped the next.",
              },
            });
          }}
          className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-extrabold text-amber-900"
        >
          Add cause and consequence question
        </button>
      )}
    </div>
  );
}
