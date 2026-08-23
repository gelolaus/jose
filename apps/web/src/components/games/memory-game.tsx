"use client";

import type { MemoryGame as MemoryContent } from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";

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
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
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
    <MemoryPlay game={game} disabled={disabled} onMiss={onMiss} onFinish={onFinish} />
  );
}

function MemoryPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: MemoryContent } & PlayBoardProps) {
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
    return built;
  }, [game.pairs]);
  const [order, setOrder] = useState(cards.map((card) => card.id));

  useEffect(() => {
    setOrder(shuffle(cards).map((card) => card.id));
  }, [cards]);

  const orderedCards = order
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is Card => Boolean(card));

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [lock, setLock] = useState(false);
  const missesRef = useRef(0);
  const [whyPair, setWhyPair] = useState<number | null>(null);

  async function flip(card: Card) {
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
      setWhyPair(first.pairId);
      setFlipped([]);
      if (nextMatched.size === game.pairs.length) {
        onFinish(
          game.pairs.length - missesRef.current,
          game.pairs.length,
          missesRef.current,
        );
      }
    } else {
      setLock(true);
      const result = await onMiss({
        title: "Not a pair",
        body: "Those two don’t go together. Flip again and look for the match.",
      });
      missesRef.current += 1;
      window.setTimeout(() => {
        setFlipped([]);
        setLock(false);
      }, result === "empty" ? 0 : 400);
    }
  }

  const fact = whyPair !== null ? game.pairs[whyPair]?.why : null;

  return (
    <div>
      <p className="mb-4 text-sm font-extrabold text-slate-500">
        Matches {matched.size}/{game.pairs.length}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {orderedCards.map((card) => {
          const open = flipped.includes(card.id) || matched.has(card.pairId);
          return (
            <li key={card.id} className="[perspective:800px]">
              <button
                type="button"
                onClick={() => void flip(card)}
                className={`flex min-h-[7.5rem] w-full items-center justify-center rounded-3xl p-3 text-center text-sm font-extrabold shadow-md ring-2 transition sm:min-h-[8.5rem] ${
                  matched.has(card.pairId)
                    ? "bg-emerald-100 text-emerald-900 ring-emerald-300"
                    : open
                      ? "bg-white text-slate-800 ring-violet-200"
                      : "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white ring-violet-700"
                }`}
              >
                {open ? (
                  <CardFace text={card.text} imageUrl={card.imageUrl} />
                ) : (
                  <span className="font-display text-3xl">?</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {fact ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {fact}
        </p>
      ) : null}
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
        Each pair is two cards on the table. Add a why so a match teaches the fact.
      </p>
      {game.pairs.map((pair, i) => (
        <div key={i} className="space-y-2 rounded-[1.5rem] bg-violet-50 p-3 ring-1 ring-violet-100">
          <div className="grid gap-2 sm:grid-cols-2">
            <SideFields
              label={`Pair ${i + 1} · A`}
              text={pair.a.text ?? ""}
              imageUrl={pair.a.imageUrl ?? ""}
              onChange={(side) => {
                const pairs = [...game.pairs];
                pairs[i] = { ...pair, a: side };
                onChange({ ...game, pairs });
              }}
            />
            <SideFields
              label="B"
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
        placeholder="Text"
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
        placeholder="Image URL (optional)"
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
