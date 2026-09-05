"use client";

import { pairExplanation, type MemoryGame as MemoryContent } from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import {
  applyMismatch,
  clockMs,
  formatClock,
  roundPhase,
} from "./memory-round";
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
  const timed = game.playMode === "timed";
  const timing = game.timing;
  const [cards, setCards] = useState(() => buildDeck(game.pairs));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [lock, setLock] = useState(false);
  const [started, setStarted] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => clockMs(pairCount, timing));
  const [whyPair, setWhyPair] = useState<number | null>(null);
  const [artifact, setArtifact] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const [lostEmpty, setLostEmpty] = useState(false);
  const [hit, setHit] = useState(false);
  const [shake, setShake] = useState(false);
  const { playCue } = useMotionSound();

  const flippedRef = useRef<string[]>([]);
  const matchedRef = useRef<Set<number>>(new Set());
  const remainingRef = useRef(clockMs(pairCount, timing));
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
    remainingRef.current = clockMs(pairCount, timing);
    setFlipped([]);
    setMatched(new Set());
    setLock(false);
    setStarted(false);
    setRemainingMs(clockMs(pairCount, timing));
    setWhyPair(null);
    setArtifact(null);
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
    if (!timed || !started || disabled || lost) return;
    const id = window.setInterval(() => {
      if (endingRef.current) return;
      remainingRef.current = Math.max(0, remainingRef.current - TICK_MS);
      setRemainingMs(remainingRef.current);
      const phase = roundPhase({
        started: true,
        remainingMs: remainingRef.current,
        matchedCount: matchedRef.current.size,
        pairCount,
        timed: true,
      });
      if (phase === "lost") void lose();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [timed, started, disabled, lost, pairCount]);

  function flip(card: Card) {
    if (disabled || lock || lost || endingRef.current) return;
    if (matched.has(card.pairIndex) || flippedRef.current.includes(card.id)) return;

    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
    }

    const next = [...flippedRef.current, card.id];
    flippedRef.current = next;
    setFlipped(next);
    playCue("select");
    if (next.length === 1) return;

    const first = cards.find((item) => item.id === next[0]);
    const second = cards.find((item) => item.id === next[1]);
    if (!first || !second) return;

    if (first.pairIndex === second.pairIndex) {
      const nextMatched = new Set(matchedRef.current);
      nextMatched.add(first.pairIndex);
      matchedRef.current = nextMatched;
      setMatched(nextMatched);
      setWhyPair(first.pairIndex);
      const pair = game.pairs[first.pairIndex];
      setArtifact(pair?.artifactLabel?.trim() || pairExplanation(pair ?? {}) || null);
      playCue("match");
      flippedRef.current = [];
      setFlipped([]);
      if (nextMatched.size === pairCount) {
        endingRef.current = true;
        playCue("artifact");
        onFinishRef.current(pairCount - missesRef.current, pairCount, missesRef.current);
      }
      return;
    }

    missesRef.current += 1;
    if (timed) {
      remainingRef.current = applyMismatch(remainingRef.current, timing);
      setRemainingMs(remainingRef.current);
    }
    playCue("reject");
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
        timed,
      });
      if (phase === "lost") void lose();
    }, FLIP_BACK_MS);
  }

  const fact =
    whyPair !== null ? pairExplanation(game.pairs[whyPair] ?? {}) : null;

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
          {timed ? (
            <p
              className={`rounded-full border-[1.5px] border-amber-300 px-3 py-1 text-sm font-extrabold text-amber-100 ${
                hit ? "clock-hit" : "bg-emerald-950"
              }`}
              aria-label={`${Math.ceil(remainingMs / 1000)} seconds left`}
            >
              {formatClock(remainingMs)}
            </p>
          ) : (
            <p className="rounded-full border-[1.5px] border-amber-300/70 bg-emerald-950 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-100">
              Archive match · untimed
            </p>
          )}
          <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-100/80">
            {matched.size} / {pairCount}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {cards.map((card) => {
            const open = flipped.includes(card.id) || matched.has(card.pairIndex);
            const label =
              card.text?.trim() ||
              card.alt?.trim() ||
              `Archive card ${card.id}`;
            return (
              <li key={card.id} className="[perspective:1000px]">
                <button
                  type="button"
                  aria-label={open ? label : `Card ${card.id}`}
                  aria-pressed={open}
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
                      <CardFace text={card.text} imageUrl={card.imageUrl} alt={card.alt} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {fact ? (
        <div className="motion-artifact mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          <p>{fact}</p>
          {artifact ? (
            <p className="mt-2 text-xs font-extrabold uppercase tracking-wide text-amber-700">
              Artifact collected: {artifact}
            </p>
          ) : null}
        </div>
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
              Timed challenge
            </p>
            <h2 id="memory-timeout-title" className="mt-2 font-display text-2xl font-semibold text-slate-800">
              Time’s up
            </h2>
            <p className="mt-2 text-base font-semibold leading-relaxed text-slate-600">
              Timed results stay separate from the untimed archive match used for learning.
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
        <span className="flex aspect-[3/4] w-[72%] max-h-[78%] items-end justify-center overflow-hidden rounded-full border-2 border-amber-400 bg-amber-100">
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
        Archive Match defaults to untimed learning. Add an explanation so every pair teaches why it
        belongs together. Timed challenge is optional.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["learning", "timed"] as const).map((playMode) => (
          <button
            key={playMode}
            type="button"
            onClick={() => onChange({ ...game, playMode })}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              game.playMode === playMode ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {playMode === "learning" ? "Learning (untimed)" : "Timed challenge"}
          </button>
        ))}
      </div>
      {game.playMode === "timed" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-extrabold text-slate-500">
            Seconds per pair
            <input
              type="number"
              min={3}
              max={60}
              value={game.timing?.secondsPerPair ?? 8}
              onChange={(e) =>
                onChange({
                  ...game,
                  timing: {
                    ...game.timing,
                    secondsPerPair: Number(e.target.value) || 8,
                    mismatchPenaltyMs: game.timing?.mismatchPenaltyMs ?? 3000,
                  },
                })
              }
              className="mt-1 w-full rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
            />
          </label>
          <label className="text-xs font-extrabold text-slate-500">
            Mismatch penalty (ms)
            <input
              type="number"
              min={0}
              max={30000}
              step={500}
              value={game.timing?.mismatchPenaltyMs ?? 3000}
              onChange={(e) =>
                onChange({
                  ...game,
                  timing: {
                    secondsPerPair: game.timing?.secondsPerPair ?? 8,
                    mismatchPenaltyMs: Number(e.target.value) || 0,
                  },
                })
              }
              className="mt-1 w-full rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
            />
          </label>
        </div>
      ) : null}
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
          <input
            value={pair.explanation ?? pair.why ?? ""}
            placeholder="Why these match"
            onChange={(e) => {
              const pairs = [...game.pairs];
              pairs[i] = {
                ...pair,
                explanation: e.target.value || undefined,
                why: e.target.value || undefined,
              };
              onChange({ ...game, pairs });
            }}
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold"
          />
          <input
            value={pair.artifactLabel ?? ""}
            placeholder="Artifact label (optional)"
            onChange={(e) => {
              const pairs = [...game.pairs];
              pairs[i] = { ...pair, artifactLabel: e.target.value || undefined };
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
            pairs: [
              ...game.pairs,
              {
                id: `pair-${Date.now()}`,
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
