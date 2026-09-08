"use client";

import {
  normalizeBlankKey,
  shuffledCopy,
  type AssessmentBlank,
  type BlankGame as BlankContent,
  type BlankItem,
} from "@jose/shared";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import { GameBoard } from "./game-board";
import type { PlayBoardProps } from "./play-types";

type BlankPlayContent = BlankContent | AssessmentBlank;

function isAuthorBlank(game: BlankPlayContent): game is BlankContent {
  return "answer" in (game.items[0] ?? {});
}

function blankBank(
  item: BlankPlayContent["items"][number],
  author: boolean,
): string[] {
  if (author && "answer" in item) return [item.answer, ...item.decoys];
  if ("options" in item) return item.options;
  return [];
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
    game.items.map((item) => blankBank(item, author)),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBanks(game.items.map((item) => shuffledCopy(blankBank(item, author))));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [author, game.items]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const missesRef = useRef(0);
  const wordsRef = useRef<string[]>([]);
  const { playCue } = useMotionSound();
  const item = game.items[index]!;
  const last = index === game.items.length - 1;
  const authoredItem = author ? game.items[index]! : null;

  async function choose(word: string) {
    if (disabled || picked) return;
    setPicked(word);
    wordsRef.current[index] = word;

    if (onEvaluate) {
      const result = await onEvaluate({
        type: "blank_choice",
        itemIndex: index,
        word,
      });
      if (result.correct) {
        playCue("accept");
        setRevealed(word);
        return;
      }
      playCue("reject");
      missesRef.current += 1;
      if (result.feedback) {
        const miss = await onMiss({
          title: result.feedback.title,
          body: result.feedback.body,
          tone: "miss",
        });
        if (miss === "empty") return;
      } else {
        await onMiss(null);
      }
      return;
    }

    if (!authoredItem) return;
    const right = normalizeBlankKey(word) === normalizeBlankKey(authoredItem.answer);
    if (right) {
      playCue("accept");
      setRevealed(authoredItem.answer);
      return;
    }
    playCue("reject");
    const distractorWhy = authoredItem.distractors?.find(
      (entry) => normalizeBlankKey(entry.text) === normalizeBlankKey(word),
    )?.why;
    const result = await onMiss({
      title: authoredItem.answer,
      body:
        distractorWhy?.trim() ||
        authoredItem.why?.trim() ||
        `The missing word is ${authoredItem.answer}.`,
      tone: "miss",
      sourceLabel: authoredItem.source?.citation || authoredItem.source?.label,
    });
    missesRef.current += 1;
    setRevealed(authoredItem.answer);
    if (result === "empty") return;
  }

  function next() {
    if (!picked) return;
    if (last) {
      onFinish(game.items.length - missesRef.current, game.items.length, missesRef.current, {
        type: "blank",
        words: game.items.map((_, i) => wordsRef.current[i] ?? ""),
      });
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(null);
  }

  const filled = picked ?? "_____";
  const sentence = item.sentence.replace("___", filled);
  const rightPick =
    picked !== null &&
    (onEvaluate
      ? revealed !== null && normalizeBlankKey(picked) === normalizeBlankKey(revealed)
      : Boolean(
          authoredItem &&
            normalizeBlankKey(picked) === normalizeBlankKey(authoredItem.answer),
        ));

  return (
    <GameBoard scene="blank" step={`Passage ${index + 1} of ${game.items.length}`}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-[var(--jose-text-muted)]">
          Passage {index + 1} of {game.items.length}
        </p>
        <p className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-rose-700">
          Restore the passage
        </p>
      </div>
      {"objective" in item && item.objective ? (
        <p className="text-xs font-semibold text-slate-500">
          Objective: {item.objective}
        </p>
      ) : null}
      <div className="rounded-[1.8rem] bg-[#fff7e8] px-5 py-8 shadow-inner ring-2 ring-amber-200 sm:px-8">
        <p className="font-display text-2xl font-semibold leading-snug text-amber-950 sm:text-3xl">
          {sentence}
        </p>
        {"source" in item && item.source ? (
          <p className="mt-4 text-xs font-bold text-amber-800/80">
            Source: {item.source.citation || item.source.label}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {banks[index]!.map((word) => {
          const on = picked === word;
          const right =
            authoredItem
              ? normalizeBlankKey(word) === normalizeBlankKey(authoredItem.answer)
              : revealed !== null && normalizeBlankKey(word) === normalizeBlankKey(revealed);
          let tone =
            "bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-[var(--jose-rule)] motion-control";
          if (picked && on && right) tone = "bg-emerald-700 text-white ring-emerald-800 motion-accept";
          else if (picked && on && !right) tone = "bg-rose-800 text-white ring-rose-900";
          else if (picked && right) tone = "bg-emerald-700/20 text-emerald-950 ring-emerald-700";
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
          <p>
            {(authoredItem?.whyCorrect || authoredItem?.why)?.trim() ||
              (revealed ? `“${revealed}” restores the passage.` : "Correct.")}
          </p>
          {authoredItem?.source ? (
            <p className="mt-2 text-xs font-bold text-emerald-800">
              Source: {authoredItem.source.citation || authoredItem.source.label}
            </p>
          ) : null}
        </div>
      ) : null}
      {picked ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="jose-button w-full"
        >
          {last ? "See stars" : "Next passage"}
        </button>
      ) : null}
    </div>
    </GameBoard>
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
