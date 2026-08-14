"use client";

import { memoryScore, type MemoryGame } from "@jose/shared";
import { useMemo, useState } from "react";

type Card = {
  id: string;
  pairId: number;
  text?: string;
  imageUrl?: string;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export function MemoryGame({
  game,
  disabled,
  onFinish,
}: {
  game: MemoryGame;
  disabled: boolean;
  onFinish: (score: number, maxScore: number, payload?: unknown) => void;
}) {
  const cards = useMemo<Card[]>(() => {
    const built: Card[] = [];
    game.pairs.forEach((pair, pairId) => {
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
    return shuffle(built);
  }, [game.pairs]);

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [mismatches, setMismatches] = useState(0);
  const [lock, setLock] = useState(false);

  function flip(card: Card) {
    if (disabled || lock) return;
    if (matched.has(card.pairId) || flipped.includes(card.id)) return;
    const next = [...flipped, card.id];
    if (next.length === 1) {
      setFlipped(next);
      return;
    }
    setFlipped(next);
    const [firstId, secondId] = next;
    const first = cards.find((c) => c.id === firstId);
    const second = cards.find((c) => c.id === secondId);
    if (!first || !second) return;
    if (first.pairId === second.pairId) {
      const nextMatched = new Set(matched);
      nextMatched.add(first.pairId);
      setMatched(nextMatched);
      setFlipped([]);
      if (nextMatched.size === game.pairs.length) {
        const { score, maxScore } = memoryScore(game.pairs.length, mismatches);
        onFinish(score, maxScore, { mismatches });
      }
    } else {
      setLock(true);
      setMismatches((n) => n + 1);
      window.setTimeout(() => {
        setFlipped([]);
        setLock(false);
      }, 800);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm font-extrabold text-slate-500">
        Matches {matched.size}/{game.pairs.length} · Misses {mismatches}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const open = flipped.includes(card.id) || matched.has(card.pairId);
          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => flip(card)}
                className={`flex min-h-[6.5rem] w-full items-center justify-center rounded-3xl p-3 text-center text-sm font-extrabold shadow-sm ring-2 transition sm:min-h-[7.5rem] ${
                  matched.has(card.pairId)
                    ? "bg-emerald-100 text-emerald-900 ring-emerald-300"
                    : open
                      ? "bg-white text-slate-800 ring-violet-200"
                      : "bg-violet-600 text-white ring-violet-700"
                }`}
              >
                {open ? (
                  <CardFace text={card.text} imageUrl={card.imageUrl} />
                ) : (
                  "?"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CardFace({ text, imageUrl }: { text?: string; imageUrl?: string }) {
  return (
    <span className="flex flex-col items-center gap-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
      ) : null}
      {text ? <span>{text}</span> : null}
    </span>
  );
}
