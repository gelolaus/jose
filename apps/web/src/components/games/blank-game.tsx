"use client";

import {
  normalizeBlankKey,
  shuffledCopy,
  type BlankGame as BlankContent,
  type BlankItem,
} from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import type { PlayBoardProps } from "./play-types";

export function BlankGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: BlankContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: BlankContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <BlankBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return <BlankPlay game={game} disabled={disabled} onMiss={onMiss} onFinish={onFinish} />;
}

function BlankPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: BlankContent } & PlayBoardProps) {
  const [banks, setBanks] = useState(() =>
    game.items.map((item) => [item.answer, ...item.decoys]),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBanks(game.items.map((item) => shuffledCopy([item.answer, ...item.decoys])));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game.items]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const missesRef = useRef(0);
  const { playCue } = useMotionSound();
  const item = game.items[index]!;
  const last = index === game.items.length - 1;

  async function choose(word: string) {
    if (disabled || picked) return;
    const right = normalizeBlankKey(word) === normalizeBlankKey(item.answer);
    setPicked(word);
    if (right) {
      playCue("accept");
      return;
    }
    playCue("reject");
    const distractorWhy = item.distractors?.find(
      (entry) => normalizeBlankKey(entry.text) === normalizeBlankKey(word),
    )?.why;
    const result = await onMiss({
      title: item.answer,
      body:
        distractorWhy?.trim() ||
        item.why?.trim() ||
        `The missing word is ${item.answer}.`,
      tone: "miss",
      sourceLabel: item.source?.citation || item.source?.label,
    });
    missesRef.current += 1;
    if (result === "empty") return;
  }

  function next() {
    if (!picked) return;
    if (last) {
      onFinish(game.items.length - missesRef.current, game.items.length, missesRef.current);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  const filled = picked ?? "_____";
  const sentence = item.sentence.replace("___", filled);
  const rightPick =
    picked !== null && normalizeBlankKey(picked) === normalizeBlankKey(item.answer);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-slate-500">
          Passage {index + 1} of {game.items.length}
        </p>
        <p className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-rose-700">
          Restore the passage
        </p>
      </div>
      {item.objective ? (
        <p className="text-xs font-semibold text-slate-500">
          Objective: {item.objective}
        </p>
      ) : null}
      <div className="rounded-[1.8rem] bg-[#fff7e8] px-5 py-8 shadow-inner ring-2 ring-amber-200 sm:px-8">
        <p className="font-display text-2xl font-semibold leading-snug text-slate-800 sm:text-3xl">
          {sentence}
        </p>
        {item.source ? (
          <p className="mt-4 text-xs font-bold text-amber-800/80">
            Source: {item.source.citation || item.source.label}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {banks[index]!.map((word) => {
          const on = picked === word;
          const right = normalizeBlankKey(word) === normalizeBlankKey(item.answer);
          let tone = "bg-white text-slate-800 ring-black/10 motion-control";
          if (picked && on && right) tone = "bg-emerald-100 text-emerald-900 ring-emerald-300 motion-accept";
          else if (picked && on && !right) tone = "bg-rose-100 text-rose-800 ring-rose-300";
          else if (picked && right) tone = "bg-emerald-50 text-emerald-800 ring-emerald-200";
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
      {rightPick ? (
        <div className="motion-artifact rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 ring-1 ring-emerald-200">
          <p>{item.whyCorrect?.trim() || item.why?.trim() || `“${item.answer}” restores the passage.`}</p>
          {item.source ? (
            <p className="mt-2 text-xs font-bold text-emerald-800">
              Source: {item.source.citation || item.source.label}
            </p>
          ) : null}
        </div>
      ) : null}
      {picked ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md"
        >
          {last ? "See stars" : "Next passage"}
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
  function patch(index: number, next: BlankItem) {
    const items = [...game.items];
    items[index] = next;
    onChange({ ...game, items });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Restore the Passage is for meaningful terms and short sourced passages — not filler dates.
        Each blank needs one ___, an objective, and a source.
      </p>
      {game.items.map((item, i) => (
        <div key={item.id ?? i} className="space-y-2 rounded-[1.5rem] bg-[#fff7e8] p-4 ring-2 ring-amber-200">
          <input
            value={item.sentence}
            onChange={(e) => patch(i, { ...item, sentence: e.target.value })}
            className="w-full bg-transparent font-display text-xl font-semibold outline-none"
          />
          <input
            value={item.answer}
            placeholder="Answer"
            onChange={(e) => patch(i, { ...item, answer: e.target.value })}
            className="w-full rounded-xl bg-white px-3 py-2 font-bold"
          />
          <input
            value={item.decoys.join(", ")}
            placeholder="Decoy words, comma separated"
            onChange={(e) =>
              patch(i, {
                ...item,
                decoys: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-full rounded-xl bg-white px-3 py-2 font-bold"
          />
          <input
            value={item.objective ?? ""}
            placeholder="Learning objective"
            onChange={(e) => patch(i, { ...item, objective: e.target.value || undefined })}
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold"
          />
          <input
            value={item.source?.label ?? ""}
            placeholder="Source label"
            onChange={(e) =>
              patch(i, {
                ...item,
                source: e.target.value
                  ? {
                      id: item.source?.id ?? `src-${i + 1}`,
                      label: e.target.value,
                      citation: item.source?.citation,
                    }
                  : undefined,
              })
            }
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold"
          />
          <input
            value={item.source?.citation ?? ""}
            placeholder="Source citation"
            onChange={(e) =>
              patch(i, {
                ...item,
                source: {
                  id: item.source?.id ?? `src-${i + 1}`,
                  label: item.source?.label ?? "Source",
                  citation: e.target.value || undefined,
                },
              })
            }
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold"
          />
          <input
            value={item.why ?? ""}
            placeholder="Why (shown on a miss)"
            onChange={(e) => patch(i, { ...item, why: e.target.value || undefined })}
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold"
          />
          <input
            value={item.whyCorrect ?? ""}
            placeholder="Why correct"
            onChange={(e) => patch(i, { ...item, whyCorrect: e.target.value || undefined })}
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
              {
                id: `blank-${Date.now()}`,
                sentence: "___ is the answer.",
                answer: "Rizal",
                decoys: ["Bonifacio"],
                objective: "State the learning goal for this blank.",
                source: { id: "src-new", label: "Module source" },
              },
            ],
          })
        }
      >
        <Plus className="size-4" /> Add passage
      </button>
    </div>
  );
}
