"use client";

import type { MemoryGame as MemoryContent } from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  applyMismatch,
  clockMs,
  formatClock,
  roundPhase,
} from "./memory-round";
import type { PlayBoardProps } from "./play-types";

type Card = {
  id: string;
  pairId: number;
  text?: string;
  imageUrl?: string;
};

const FLIP_BACK_MS = 700;
const TICK_MS = 100;

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
  pairs.forEach((pair, pairId) => {
    built.push({
      id: `${pairId}-a`,
      pairId,
      text: pair.a.text,
      imageUrl: pair.a.imageUrl,
    });
    built.push({
      id: `${pairId}-b`,
      pairId,
      text: pair.b.text,
      imageUrl: pair.b.imageUrl,
    });
  });
  return built;
}

function deal(pairs: MemoryContent["pairs"]): Card[] {
  return shuffle(buildDeck(pairs));
}

export function MemoryGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onHeartsEmpty,
  onChange,
}: {
  game: MemoryContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: MemoryContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <MemoryBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <MemoryPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
      onHeartsEmpty={onHeartsEmpty}
    />
  );
}

function MemoryPlay({
  game,
  disabled,
  onMiss,
  onFinish,
  onHeartsEmpty,
}: { game: MemoryContent } & PlayBoardProps) {
  const pairCount = game.pairs.length;
  const [cards, setCards] = useState(() => buildDeck(game.pairs));

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [lock, setLock] = useState(false);
  const [started, setStarted] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => clockMs(pairCount));
  const [whyPair, setWhyPair] = useState<number | null>(null);
  const [lost, setLost] = useState(false);
  const [lostEmpty, setLostEmpty] = useState(false);
  const [hit, setHit] = useState(false);
  const [shake, setShake] = useState(false);

  const flippedRef = useRef<string[]>([]);
  const matchedRef = useRef<Set<number>>(new Set());
  const remainingRef = useRef(clockMs(pairCount));
  const startedRef = useRef(false);
  const missesRef = useRef(0);
  const endingRef = useRef(false);
  const onMissRef = useRef(onMiss);
  const onFinishRef = useRef(onFinish);
  const lostDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onMissRef.current = onMiss;
    onFinishRef.current = onFinish;
  }, [onFinish, onMiss]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCards(deal(game.pairs)), 0);
    return () => window.clearTimeout(timer);
  }, [game.pairs]);

  useEffect(() => {
    if (lost) lostDialogRef.current?.focus();
  }, [lost]);

  function resetBoard() {
    endingRef.current = false;
    startedRef.current = false;
    missesRef.current = 0;
    flippedRef.current = [];
    matchedRef.current = new Set();
    remainingRef.current = clockMs(pairCount);
    setFlipped([]);
    setMatched(new Set());
    setLock(false);
    setStarted(false);
    setRemainingMs(clockMs(pairCount));
    setWhyPair(null);
    setLost(false);
    setLostEmpty(false);
    setHit(false);
    setShake(false);
    setCards(deal(game.pairs));
  }

  async function lose() {
    if (endingRef.current) return;
    endingRef.current = true;
    setLock(true);
    setLost(true);
    const result = await onMissRef.current(null, { hold: true });
    setLostEmpty(result === "empty");
  }

  useEffect(() => {
    if (!started || disabled || lost) return;
    const id = window.setInterval(() => {
      if (endingRef.current) return;
      remainingRef.current = Math.max(0, remainingRef.current - TICK_MS);
      setRemainingMs(remainingRef.current);
      const phase = roundPhase({
        started: true,
        remainingMs: remainingRef.current,
        matchedCount: matchedRef.current.size,
        pairCount,
      });
      if (phase === "lost") void lose();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [started, disabled, lost, pairCount]);

  function flip(card: Card) {
    if (disabled || lock || lost || endingRef.current) return;
    if (matched.has(card.pairId) || flippedRef.current.includes(card.id)) return;

    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
    }

    const next = [...flippedRef.current, card.id];
    flippedRef.current = next;
    setFlipped(next);
    if (next.length === 1) return;

    const first = cards.find((item) => item.id === next[0]);
    const second = cards.find((item) => item.id === next[1]);
    if (!first || !second) return;

    if (first.pairId === second.pairId) {
      const nextMatched = new Set(matchedRef.current);
      nextMatched.add(first.pairId);
      matchedRef.current = nextMatched;
      setMatched(nextMatched);
      setWhyPair(first.pairId);
      flippedRef.current = [];
      setFlipped([]);
      if (nextMatched.size === pairCount) {
        endingRef.current = true;
        onFinishRef.current(pairCount - missesRef.current, pairCount, missesRef.current);
      }
      return;
    }

    missesRef.current += 1;
    remainingRef.current = applyMismatch(remainingRef.current);
    setRemainingMs(remainingRef.current);
    setHit(true);
    setShake(true);
    window.setTimeout(() => setHit(false), 400);
    setLock(true);
    window.setTimeout(() => {
      flippedRef.current = [];
      setFlipped([]);
      setLock(false);
      setShake(false);
      const phase = roundPhase({
        started: true,
        remainingMs: remainingRef.current,
        matchedCount: matchedRef.current.size,
        pairCount,
      });
      if (phase === "lost") void lose();
    }, FLIP_BACK_MS);
  }

  const fact = whyPair !== null ? game.pairs[whyPair]?.why : null;

  return (
    <div>
      <div
        className={`rounded-[1.75rem] p-3 shadow-[inset_0_0_0_3px_#245538,0_8px_0_#1a3d28] sm:p-5 ${
          shake ? "snap-back" : ""
        }`}
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12), transparent 50%), #2f6a45",
        }}
      >
        <div className="mb-3 flex items-center justify-center gap-3 sm:mb-4">
          <p
            className={`rounded-full border-[1.5px] border-amber-300 px-3 py-1 text-sm font-extrabold text-amber-100 ${
              hit ? "clock-hit" : "bg-emerald-950"
            }`}
            aria-label={`${Math.ceil(remainingMs / 1000)} seconds left`}
          >
            {formatClock(remainingMs)}
          </p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-100/80">
            {matched.size} / {pairCount}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {cards.map((card) => {
            const open = flipped.includes(card.id) || matched.has(card.pairId);
            return (
              <li key={card.id} className="[perspective:1000px]">
                <button
                  type="button"
                  aria-label={`Card ${card.id}`}
                  onClick={() => flip(card)}
                  className="block w-full [transform-style:preserve-3d]"
                >
                  <span
                    className={`card-flip relative block aspect-[3/4] w-full ${
                      open ? "card-flip-open" : ""
                    }`}
                  >
                    <span className="card-face absolute inset-0 overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-br from-violet-700 to-violet-950 shadow-[0_4px_0_#3b0764] sm:rounded-2xl">
                      <span
                        className="absolute inset-1.5 rounded-lg border border-amber-300/50 sm:inset-2 sm:rounded-xl"
                        aria-hidden
                      />
                      <span className="relative flex h-full items-center justify-center font-display text-2xl text-amber-300 sm:text-3xl">
                        ★
                      </span>
                    </span>
                    <span className="card-face card-face-front absolute inset-0 overflow-hidden rounded-xl border-2 border-amber-200 bg-[#fff8ef] shadow-[0_4px_0_#c4b48a] sm:rounded-2xl">
                      <CardFace text={card.text} imageUrl={card.imageUrl} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {fact ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {fact}
        </p>
      ) : null}
      {lost ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/35 p-4 sm:items-center">
          <div
            ref={lostDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-timeout-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-[1.75rem] bg-white p-5 shadow-xl outline-none ring-2 ring-amber-200 sm:p-6"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-600">
              Memory
            </p>
            <h2 id="memory-timeout-title" className="mt-2 font-display text-2xl font-semibold text-slate-800">
              Time’s up
            </h2>
            <p className="mt-2 text-base font-semibold leading-relaxed text-slate-600">
              The clock ran out before every pair was found.
            </p>
            {lostEmpty ? (
              <button
                type="button"
                onClick={() => onHeartsEmpty?.()}
                className="mt-5 w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md"
              >
                Take a break
              </button>
            ) : (
              <button
                type="button"
                onClick={resetBoard}
                className="mt-5 w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CardFace({ text, imageUrl }: { text?: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <span className="flex h-full flex-col items-center justify-center gap-1.5 p-2">
        <span className="flex aspect-[3/4] w-[72%] max-h-[78%] items-end justify-center overflow-hidden rounded-full border-2 border-amber-400 bg-amber-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
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
      <span className="font-display text-sm font-semibold leading-snug text-slate-800 sm:text-base">
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
        Best as a photo on one card and a name on the other. Text-only pairs still work. Add a why
        so a match teaches the fact.
      </p>
      {game.pairs.map((pair, i) => (
        <div key={i} className="space-y-2 rounded-[1.5rem] bg-violet-50 p-3 ring-1 ring-violet-100">
          <div className="grid gap-2 sm:grid-cols-2">
            <SideFields
              label={`Pair ${i + 1} · Photo`}
              text={pair.a.text ?? ""}
              imageUrl={pair.a.imageUrl ?? ""}
              onChange={(side) => {
                const pairs = [...game.pairs];
                pairs[i] = { ...pair, a: side };
                onChange({ ...game, pairs });
              }}
            />
            <SideFields
              label="Name"
              text={pair.b.text ?? ""}
              imageUrl={pair.b.imageUrl ?? ""}
              onChange={(side) => {
                const pairs = [...game.pairs];
                pairs[i] = { ...pair, b: side };
                onChange({ ...game, pairs });
              }}
            />
          </div>
          <input
            value={pair.why ?? ""}
            placeholder="Why these match"
            onChange={(e) => {
              const pairs = [...game.pairs];
              pairs[i] = { ...pair, why: e.target.value || undefined };
              onChange({ ...game, pairs });
            }}
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold"
          />
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-violet-700"
        onClick={() =>
          onChange({
            ...game,
            pairs: [...game.pairs, { a: { text: "New A" }, b: { text: "New B" } }],
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
  onChange,
}: {
  label: string;
  text: string;
  imageUrl: string;
  onChange: (side: { text?: string; imageUrl?: string }) => void;
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
          })
        }
        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
      />
    </div>
  );
}
