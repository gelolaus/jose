"use client";

import {
  type AssessmentMemory,
  type MemoryGame as MemoryContent,
} from "@jose/shared";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import {
  clockMs,
  formatClock,
} from "./memory-round";
import { GameBoard } from "./game-board";
import type { PlayBoardProps } from "./play-types";

type Card = {
  id: string;
  pairIndex: number;
  pairId: string;
  text?: string;
  imageUrl?: string;
  alt?: string;
};

const FLIP_BACK_MS = 700;
const TICK_MS = 100;

// Read the wall clock only from event handlers and timer callbacks.
const eventTime = () => Date.now();

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function buildDeck(pairs: MemoryContent["pairs"]): Card[] {
  const built: Card[] = [];
  pairs.forEach((pair, pairIndex) => {
    const pairId = pair.id || `pair-${pairIndex}`;
    built.push({
      id: `${pairId}-a`,
      pairIndex,
      pairId,
      text: pair.a.text,
      imageUrl: pair.a.imageUrl,
      alt: pair.a.alt,
    });
    built.push({
      id: `${pairId}-b`,
      pairIndex,
      pairId,
      text: pair.b.text,
      imageUrl: pair.b.imageUrl,
      alt: pair.b.alt,
    });
  });
  return built;
}

function deal(pairs: MemoryContent["pairs"]): Card[] {
  return shuffle(buildDeck(pairs));
}

function assessmentCards(game: AssessmentMemory): Card[] {
  return game.cards.map((card, index) => ({
    id: card.id,
    pairIndex: index,
    pairId: card.id,
    text: card.text,
    imageUrl: card.imageUrl,
    alt: card.alt,
  }));
}

type MemoryPlayContent = MemoryContent | AssessmentMemory;

function isAuthorMemory(game: MemoryPlayContent): game is MemoryContent {
  return "pairs" in game;
}

export function MemoryGame({ game, mode = "play", disabled = false, onFinish, onEvaluate, onChange }: {
  game: MemoryPlayContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: MemoryContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange && isAuthorMemory(game)) return <MemoryBuild game={game} onChange={onChange} />;
  if (!onFinish) return null;
  return <MemoryPlay key={JSON.stringify(game)} game={game} disabled={disabled} onFinish={onFinish} onEvaluate={onEvaluate} />;
}

function MemoryPlay({ game, disabled, onFinish, onEvaluate }: { game: MemoryPlayContent } & Pick<PlayBoardProps, "disabled" | "onFinish" | "onEvaluate">) {
  const author = isAuthorMemory(game);
  const pairCount = author ? game.pairs.length : game.pairCount;
  const duration = !author && game.durationMs ? game.durationMs : clockMs(pairCount);
  const [cards, setCards] = useState(() => author ? buildDeck(game.pairs) : assessmentCards(game));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [remainingMs, setRemainingMs] = useState(duration);
  const [error, setError] = useState<string | null>(null);
  const { playCue } = useMotionSound();
  const state = useRef({ flipped: [] as string[], matched: new Set<string>(), matches: [] as {cardA: string; cardB: string}[], deadline: 0, locked: false, ended: false, alive: true });
  const callbacks = useRef({ onFinish, onEvaluate });
  useEffect(() => { callbacks.current = { onFinish, onEvaluate }; }, [onFinish, onEvaluate]);
  useEffect(() => {
    const round = state.current;
    round.alive = true;
    const dealTimer = window.setTimeout(() => { if (!round.deadline) setCards(author ? deal(game.pairs) : assessmentCards(game)); }, 0);
    return () => { round.alive = false; window.clearTimeout(dealTimer); };
  }, [author, game]);

  const finish = useCallback((timedOut: boolean) => {
    const round = state.current;
    if (round.ended || !round.alive) return;
    round.ended = true;
    round.locked = true;
    setLocked(true);
    callbacks.current.onFinish(timedOut ? 0 : pairCount, pairCount, timedOut ? pairCount : 0, {
      type: "memory", matches: [...round.matches], ...(timedOut ? { timedOut: true } : {}),
    });
  }, [pairCount]);
  function expired() {
    if (!state.current.alive || state.current.ended) return true;
    if (state.current.deadline && eventTime() >= state.current.deadline) { finish(true); return true; }
    return false;
  }
  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      const round = state.current;
      if (round.ended || !round.alive) return;
      const left = Math.max(0, round.deadline - eventTime());
      setRemainingMs(left);
      if (left === 0) finish(true);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [started, finish]);

  async function flip(card: Card) {
    const round = state.current;
    if (disabled || round.locked || expired() || round.matched.has(card.id) || round.flipped.includes(card.id)) return;
    setError(null);
    const firstFlip = !round.deadline;
    if (firstFlip) { round.deadline = eventTime() + duration; setStarted(true); }
    round.flipped = [...round.flipped, card.id];
    setFlipped(round.flipped);
    playCue("select");
    if (firstFlip && callbacks.current.onEvaluate) {
      round.locked = true; setLocked(true);
      try {
        const result = await callbacks.current.onEvaluate({ type: "memory_start" });
        if (expired()) return;
        if (result.remainingMs !== undefined) {
          round.deadline = Math.min(round.deadline, eventTime() + result.remainingMs);
          setRemainingMs(Math.max(0, round.deadline - eventTime()));
          if (expired()) return;
        }
      } catch {
        if (expired()) return;
        // Retry the idempotent start event on the next card tap.
        round.deadline = 0; round.flipped = []; setFlipped([]); setStarted(false);
        setError("Couldn't start the round. Tap a card to try again.");
      } finally {
        if (round.alive && !round.ended) { round.locked = false; setLocked(false); }
      }
      return;
    }
    if (round.flipped.length < 2) return;
    const first = cards.find(item => item.id === round.flipped[0])!;
    round.locked = true; setLocked(true);
    let correct = first.pairIndex === card.pairIndex;
    try {
      if (callbacks.current.onEvaluate) {
        const result = await callbacks.current.onEvaluate({ type: "memory_match", cardA: first.id, cardB: card.id });
        if (expired()) return;
        correct = result.correct;
      }
    } catch {
      if (expired()) return;
      correct = false;
      setError("Couldn't check that pair. Try again.");
    }
    if (expired()) return;
    if (correct) {
      round.matches.push({ cardA: first.id, cardB: card.id });
      round.matched = new Set([...round.matched, first.id, card.id]);
      setMatched(round.matched);
      round.flipped = []; setFlipped([]);
      round.locked = false; setLocked(false);
      playCue("match");
      if (round.matches.length === pairCount) finish(false);
    } else {
      window.setTimeout(() => {
        if (expired()) return;
        round.flipped = []; setFlipped([]);
        round.locked = false; setLocked(false);
      }, FLIP_BACK_MS);
    }
  }
  return (
    <GameBoard scene="memory" how="Flip two cards and find every pair before time runs out." step={started ? "Keep finding pairs!" : "Your first flip starts the timer"}>
      <div className="rounded-3xl border-2 border-sky-100 bg-sky-50/70 p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="rounded-2xl border-2 border-sky-200 bg-white px-4 py-2 text-xl font-extrabold tabular-nums text-sky-700" role="timer" aria-label={`${Math.ceil(remainingMs / 1000)} seconds left`}>{formatClock(remainingMs)}</p>
          <p className="text-sm font-extrabold text-slate-600" aria-live="polite">{matched.size / 2} / {pairCount} pairs</p>
        </div>
        <div className="mb-4 h-3 overflow-hidden rounded-full bg-sky-100" role="progressbar" aria-label="Pairs matched" aria-valuenow={matched.size / 2} aria-valuemin={0} aria-valuemax={pairCount}>
          <div className="h-full rounded-full bg-lime-500 transition-all" style={{ width: `${pairCount ? matched.size / 2 / pairCount * 100 : 0}%` }} />
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((card, index) => {
            const done = matched.has(card.id), open = done || flipped.includes(card.id);
            const label = card.text?.trim() || card.alt?.trim() || "Image card";
            return <li key={card.id}>
              <button type="button" data-card-id={card.id} aria-label={open ? `Revealed: ${label}` : "Hidden card"} aria-pressed={open} disabled={disabled || locked || done} onClick={() => void flip(card)} className={`relative block min-h-32 w-full rounded-2xl border-2 border-b-[5px] p-2 transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-500 active:translate-y-1 sm:min-h-40 ${done ? "border-lime-500 bg-lime-50" : open ? "border-sky-300 bg-white" : index % 2 ? "border-lime-600 bg-lime-500 text-white" : "border-sky-600 bg-sky-400 text-white"}`}>
                {open ? <CardFace text={card.text} imageUrl={card.imageUrl} alt={card.alt} /> : <span aria-hidden="true" className="text-4xl font-extrabold">?</span>}
                {done ? <span aria-hidden="true" className="absolute right-1 top-1 rounded-full bg-lime-500 px-1.5 text-xs font-extrabold text-white">✓</span> : null}
              </button>
            </li>;
          })}
        </ul>
        {error ? <p role="status" className="mt-3 text-sm text-slate-600">{error}</p> : null}
      </div>
    </GameBoard>
  );
}

function CardFace({
  text,
  imageUrl,
  alt,
}: {
  text?: string;
  imageUrl?: string;
  alt?: string;
}) {
  if (imageUrl) {
    return (
      <span className="flex h-full flex-col items-center justify-center gap-1.5 p-2">
        <span className="flex aspect-[3/4] w-[72%] max-h-[78%] items-end justify-center overflow-hidden rounded-xl border-2 border-sky-200 bg-sky-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt?.trim() || text?.trim() || "Historical image"}
            className="h-full w-full object-cover"
          />
        </span>
        {text ? (
          <span className="line-clamp-2 text-center text-[0.65rem] font-extrabold leading-tight text-slate-700 sm:text-xs">
            {text}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex h-full items-center justify-center p-3">
      <span className="text-sm font-bold leading-snug text-slate-800 sm:text-base">
        {text}
      </span>
    </span>
  );
}

function MemoryBuild({
  game,
  onChange,
}: {
  game: MemoryContent;
  onChange: (game: MemoryContent) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Add pairs for students to match. They have 15 seconds per pair, with at least one minute to play.
      </p>
      {game.pairs.map((pair, i) => (
        <div key={pair.id} className="space-y-2 rounded-[1.5rem] bg-violet-50 p-3 ring-1 ring-violet-100">
          <div className="grid gap-2 sm:grid-cols-2">
            <SideFields
              label={`Pair ${i + 1} · Side A`}
              text={pair.a.text ?? ""}
              imageUrl={pair.a.imageUrl ?? ""}
              alt={pair.a.alt ?? ""}
              onChange={(side) => {
                const pairs = [...game.pairs];
                pairs[i] = { ...pair, a: side };
                onChange({ ...game, pairs });
              }}
            />
            <SideFields
              label="Side B"
              text={pair.b.text ?? ""}
              imageUrl={pair.b.imageUrl ?? ""}
              alt={pair.b.alt ?? ""}
              onChange={(side) => {
                const pairs = [...game.pairs];
                pairs[i] = { ...pair, b: side };
                onChange({ ...game, pairs });
              }}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-violet-700"
        onClick={() =>
          onChange({
            ...game,
            pairs: [
              ...game.pairs,
              {
                id: `pair-${eventTime()}`,
                a: { text: "New A" },
                b: { text: "New B" },
                explanation: "Explain the link.",
              },
            ],
          })
        }
      >
        <Plus className="size-4" /> Add pair
      </button>
    </div>
  );
}

function SideFields({
  label,
  text,
  imageUrl,
  alt,
  onChange,
}: {
  label: string;
  text: string;
  imageUrl: string;
  alt: string;
  onChange: (side: { text?: string; imageUrl?: string; alt?: string }) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs font-extrabold text-slate-500">{label}</p>
      <input
        value={text}
        placeholder="Name or caption"
        onChange={(e) =>
          onChange({
            text: e.target.value || undefined,
            imageUrl: imageUrl || undefined,
            alt: alt || undefined,
          })
        }
        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
      />
      <input
        value={imageUrl}
        placeholder="Photo URL (https)"
        onChange={(e) =>
          onChange({
            text: text || undefined,
            imageUrl: e.target.value || undefined,
            alt: alt || undefined,
          })
        }
        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
      />
      <input
        value={alt}
        placeholder="Image alt text"
        onChange={(e) =>
          onChange({
            text: text || undefined,
            imageUrl: imageUrl || undefined,
            alt: e.target.value || undefined,
          })
        }
        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
      />
    </div>
  );
}
