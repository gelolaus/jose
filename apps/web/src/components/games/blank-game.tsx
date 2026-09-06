"use client";

import type { AssessmentBlank, BlankGame as BlankContent } from "@jose/shared";
import { shuffledCopy } from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";

type BlankPlayContent = BlankContent | AssessmentBlank;

function isAuthorBlank(game: BlankPlayContent): game is BlankContent {
  const item = game.items[0];
  return Boolean(item && "answer" in item);
}

export function BlankGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onEvaluate,
  onChange,
}: {
  game: BlankPlayContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: BlankContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange && isAuthorBlank(game)) {
    return <BlankBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <BlankPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
      onEvaluate={onEvaluate}
    />
  );
}

function BlankPlay({
  game,
  disabled,
  onMiss,
  onFinish,
  onEvaluate,
}: { game: BlankPlayContent } & PlayBoardProps) {
  const author = isAuthorBlank(game);
  const [banks, setBanks] = useState(() =>
    game.items.map((item) =>
      author && "answer" in item
        ? [item.answer, ...item.decoys]
        : "options" in item
          ? [...item.options]
          : [],
    ),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBanks(
        game.items.map((item) => {
          if (author && "answer" in item) {
            return shuffledCopy([item.answer, ...item.decoys]);
          }
          if ("options" in item) return shuffledCopy([...item.options]);
          return [];
        }),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game.items, author]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  const missesRef = useRef(0);
  const wordsRef = useRef<string[]>([]);
  const item = game.items[index]!;
  const last = index === game.items.length - 1;

  async function choose(word: string) {
    if (disabled || picked) return;
    setPicked(word);

    if (onEvaluate) {
      const result = await onEvaluate({
        type: "blank_choice",
        itemIndex: index,
        word,
      });
      wordsRef.current[index] = word;
      setWasCorrect(result.correct);
      if (result.correct) return;
      missesRef.current += 1;
      if (result.feedback) {
        const miss = await onMiss(result.feedback);
        if (miss === "empty") return;
      } else {
        await onMiss(null);
      }
      return;
    }

    if (!author || !("answer" in item)) return;
    const right = word.trim().toLowerCase() === item.answer.trim().toLowerCase();
    wordsRef.current[index] = word;
    setWasCorrect(right);
    if (right) return;
    const miss = await onMiss({
      title: item.answer,
      body: item.why?.trim() || `The missing word is ${item.answer}.`,
    });
    missesRef.current += 1;
    if (miss === "empty") return;
  }

  function next() {
    if (!picked) return;
    if (last) {
      onFinish(
        game.items.length - missesRef.current,
        game.items.length,
        missesRef.current,
        {
          type: "blank",
          words: game.items.map((_, i) => wordsRef.current[i] ?? ""),
        },
      );
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setWasCorrect(false);
  }

  const filled = picked ?? "_____";
  const sentence = item.sentence.replace("___", filled);

  return (
    <div className="space-y-5">
      <p className="text-sm font-extrabold text-slate-500">
        Letter {index + 1} of {game.items.length}
      </p>
      <div className="rounded-[1.8rem] bg-[#fff7e8] px-5 py-8 shadow-inner ring-2 ring-amber-200 sm:px-8">
        <p className="font-display text-2xl font-semibold leading-snug text-slate-800 sm:text-3xl">
          {sentence}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {banks[index]!.map((word) => {
          const on = picked === word;
          const right = Boolean(picked) && wasCorrect && on;
          const wrong = Boolean(picked) && !wasCorrect && on;
          let tone = "bg-white text-slate-800 ring-black/10";
          if (right) tone = "bg-emerald-100 text-emerald-900 ring-emerald-300";
          else if (wrong) tone = "bg-rose-100 text-rose-800 ring-rose-300";
          return (
            <button
              key={word}
              type="button"
              disabled={disabled || Boolean(picked)}
              onClick={() => void choose(word)}
              className={`rounded-full px-4 py-2 text-sm font-extrabold ring-2 ${tone}`}
            >
              {word}
            </button>
          );
        })}
      </div>
      {picked ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md"
        >
          {last ? "See stars" : "Next letter"}
        </button>
      ) : null}
    </div>
  );
}

function BlankBuild({
  game,
  onChange,
}: {
  game: BlankContent;
  onChange: (game: BlankContent) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Write the sentence with ___ for the hole. Students pick chips, not a keyboard.
      </p>
      {game.items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-[1.5rem] bg-[#fff7e8] p-4 ring-2 ring-amber-200">
          <input
            value={item.sentence}
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, sentence: e.target.value };
              onChange({ ...game, items });
            }}
            className="w-full bg-transparent font-display text-xl font-semibold outline-none"
          />
          <input
            value={item.answer}
            placeholder="Answer"
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, answer: e.target.value };
              onChange({ ...game, items });
            }}
            className="w-full rounded-xl bg-white px-3 py-2 font-bold"
          />
          <input
            value={item.decoys.join(", ")}
            placeholder="Decoy words, comma separated"
            onChange={(e) => {
              const items = [...game.items];
              items[i] = {
                ...item,
                decoys: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              onChange({ ...game, items });
            }}
            className="w-full rounded-xl bg-white px-3 py-2 font-bold"
          />
          <input
            value={item.why ?? ""}
            placeholder="Why (shown on a miss)"
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, why: e.target.value || undefined };
              onChange({ ...game, items });
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
            items: [
              ...game.items,
              { sentence: "___ is the answer.", answer: "Rizal", decoys: ["Bonifacio"] },
            ],
          })
        }
      >
        <Plus className="size-4" /> Add sentence
      </button>
    </div>
  );
}
