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
import { useReportSessionProgress } from "./game-stage";
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
  const [accepted, setAccepted] = useState(false);
  const [missed, setMissed] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const report = useReportSessionProgress();
  const missesRef = useRef(0);
  const wordsRef = useRef<string[]>([]);
  const { playCue } = useMotionSound();
  const item = game.items[index]!;
  const last = index === game.items.length - 1;
  const authoredItem = author ? game.items[index]! : null;

  useEffect(() => {
    const total = game.items.length;
    if (total < 1) return;
    const showNext = accepted && index < total - 1;
    report({
      label: `Sentence ${showNext ? index + 2 : index + 1} of ${total}`,
      value: accepted ? Math.min(total, index + 1) : index,
      max: total,
    });
  }, [accepted, game.items.length, index, report]);

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
        setAccepted(true);
        return;
      }
      playCue("reject");
      missesRef.current += 1;
      setMissed(true);
      const miss = result.feedback
        ? await onMiss({
            title: result.feedback.title,
            body: result.feedback.body,
            tone: "miss",
          })
        : await onMiss(null);
      if (miss === "empty") return;
      setPicked(null);
      setMissed(false);
      return;
    }

    if (!authoredItem) return;
    const right = normalizeBlankKey(word) === normalizeBlankKey(authoredItem.answer);
    if (right) {
      playCue("accept");
      setRevealed(word);
      setAccepted(true);
      return;
    }
    playCue("reject");
    const distractorWhy = authoredItem.distractors?.find(
      (entry) => normalizeBlankKey(entry.text) === normalizeBlankKey(word),
    )?.why;
    missesRef.current += 1;
    setMissed(true);
    const result = await onMiss({
      title: "Not quite",
      body:
        distractorWhy?.trim() ||
        authoredItem.why?.trim() ||
        "That word does not restore the passage.",
      tone: "miss",
      sourceLabel: authoredItem.source?.citation || authoredItem.source?.label,
    });
    if (result === "empty") return;
    setPicked(null);
    setMissed(false);
  }

  function next() {
    if (!accepted || !picked) return;
    if (last) {
      onFinish(game.items.length - missesRef.current, game.items.length, missesRef.current, {
        type: "blank",
        words: game.items.map((_, i) => wordsRef.current[i] ?? ""),
      });
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setAccepted(false);
    setMissed(false);
    setRevealed(null);
  }

  const filled = picked ?? "_____";
  const sentence = item.sentence.replace("___", filled);
  const rightPick = accepted && picked !== null;

  return (
    <GameBoard scene="blank" step={`Sentence ${index + 1} of ${game.items.length}`}>
    <div className="space-y-5">
      <div className="rounded-3xl border-2 border-[var(--jose-rule)] bg-[var(--jose-wash)] px-5 py-8 sm:px-8">
        <p className="text-2xl font-extrabold leading-relaxed text-[var(--jose-text)] sm:text-3xl">
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
          let tone =
            "bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-[var(--jose-rule)] motion-control";
          if (accepted && on) tone = "bg-[#1a2a5e] text-white ring-[#1a1a3e] motion-accept";
          else if (missed && on) tone = "bg-[#5a0a1e] text-white ring-[#5a0a1e]";
          return (
            <button
              key={word}
              type="button"
              disabled={disabled || Boolean(picked)}
              onClick={() => void choose(word)}
              className={`min-h-14 rounded-2xl px-5 py-3 text-base font-extrabold ring-2 shadow-[0_3px_0_var(--jose-rule)] ${tone}`}
            >
              {word}
            </button>
          );
        })}
      </div>
      {rightPick ? (
        <div className="motion-artifact rounded-2xl bg-[#e8dcc0] px-4 py-3 text-sm font-semibold text-[#0a0a1a] ring-1 ring-emerald-200">
          <p>
            {(authoredItem?.whyCorrect || authoredItem?.why)?.trim() ||
              (revealed ? `“${revealed}” restores the passage.` : "Correct.")}
          </p>
          {authoredItem?.source ? (
            <p className="mt-2 text-xs font-bold text-[#1a1a3e]">
              Source: {authoredItem.source.citation || authoredItem.source.label}
            </p>
          ) : null}
        </div>
      ) : null}
      {accepted ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="jose-button w-full"
        >
          {last ? "Finish" : "Next"}
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
        className="inline-flex items-center gap-1 text-sm font-extrabold text-[#1a2a5e]"
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
