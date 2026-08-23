"use client";

import type { QuizGame as QuizContent } from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";

export function QuizGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: QuizContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: QuizContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <QuizBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return <QuizPlay game={game} disabled={disabled} onMiss={onMiss} onFinish={onFinish} />;
}

function QuizPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: QuizContent } & PlayBoardProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const missesRef = useRef(0);
  const question = game.questions[index]!;
  const last = index === game.questions.length - 1;

  async function choose(choiceIndex: number) {
    if (picked !== null || disabled) return;
    const right = choiceIndex === question.correctIndex;
    setPicked(choiceIndex);
    if (right) return;
    const correct = question.choices[question.correctIndex]!;
    const result = await onMiss({
      title: correct,
      body: question.why?.trim() || `The right answer is ${correct}.`,
    });
    missesRef.current += 1;
    if (result === "empty") return;
  }

  function next() {
    if (picked === null) return;
    if (last) {
      onFinish(
        game.questions.length - missesRef.current,
        game.questions.length,
        missesRef.current,
      );
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-extrabold text-slate-500">
        Question {index + 1} of {game.questions.length}
      </p>
      <div className="rounded-[1.8rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-8 text-center shadow-lg sm:px-8">
        <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
          {question.prompt}
        </p>
      </div>
      <ul className="space-y-2.5">
        {question.choices.map((choice, i) => {
          const selected = picked === i;
          const right = i === question.correctIndex;
          let tone = "bg-white ring-black/10 hover:bg-violet-50 node-3d";
          if (picked !== null && selected && right) tone = "bg-emerald-100 ring-emerald-300";
          else if (picked !== null && selected && !right) tone = "bg-rose-100 ring-rose-300 snap-back";
          else if (picked !== null && right) tone = "bg-emerald-50 ring-emerald-200";
          return (
            <li key={`${i}-${choice}`}>
              <button
                type="button"
                disabled={picked !== null || disabled}
                onClick={() => void choose(i)}
                className={`w-full rounded-3xl px-4 py-3.5 text-left text-base font-extrabold text-slate-800 ring-2 ${tone}`}
              >
                {choice}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
        >
          {last ? "See stars" : "Next"}
        </button>
      ) : null}
    </div>
  );
}

function QuizBuild({
  game,
  onChange,
}: {
  game: QuizContent;
  onChange: (game: QuizContent) => void;
}) {
  const [index, setIndex] = useState(0);
  const question = game.questions[index]!;

  function patch(next: typeof question) {
    const questions = [...game.questions];
    questions[index] = next;
    onChange({ ...game, questions });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Write the prompt on the stage. Tap the correct choice. Add a why for misses.
      </p>
      <div className="flex flex-wrap gap-2">
        {game.questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              i === index ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Q{i + 1}
          </button>
        ))}
      </div>
      <label className="block rounded-[1.8rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-6">
        <span className="text-xs font-extrabold uppercase tracking-wide text-violet-100">
          Prompt
        </span>
        <textarea
          value={question.prompt}
          onChange={(e) => patch({ ...question, prompt: e.target.value })}
          rows={3}
          className="mt-2 w-full resize-none bg-transparent font-display text-2xl font-semibold text-white outline-none placeholder:text-white/50"
        />
      </label>
      <ul className="space-y-2">
        {question.choices.map((choice, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => patch({ ...question, correctIndex: i })}
              className={`size-10 shrink-0 rounded-full text-xs font-extrabold ring-2 ${
                question.correctIndex === i
                  ? "bg-emerald-500 text-white ring-emerald-600"
                  : "bg-white text-slate-500 ring-black/10"
              }`}
            >
              {question.correctIndex === i ? "✓" : i + 1}
            </button>
            <input
              value={choice}
              onChange={(e) => {
                const choices = [...question.choices];
                choices[i] = e.target.value;
                patch({ ...question, choices });
              }}
              className="flex-1 rounded-3xl bg-white px-4 py-3 font-extrabold ring-2 ring-black/10"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-xs font-extrabold text-violet-700"
        onClick={() =>
          patch({
            ...question,
            choices: [...question.choices, `Choice ${question.choices.length + 1}`],
          })
        }
      >
        Add choice
      </button>
      <label className="block text-xs font-extrabold text-slate-500">
        Why (shown on a miss)
        <textarea
          value={question.why ?? ""}
          onChange={(e) => patch({ ...question, why: e.target.value || undefined })}
          rows={2}
          className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({
              ...game,
              questions: [
                ...game.questions,
                { prompt: "New question", choices: ["A", "B"], correctIndex: 0 },
              ],
            })
          }
          className="inline-flex items-center gap-1 text-sm font-extrabold text-violet-700"
        >
          <Plus className="size-4" /> Add question
        </button>
        <button
          type="button"
          disabled={game.questions.length <= 1}
          onClick={() => {
            const questions = game.questions.filter((_, i) => i !== index);
            onChange({ ...game, questions });
            setIndex(Math.max(0, index - 1));
          }}
          className="ml-auto inline-flex items-center gap-1 text-sm font-extrabold text-rose-700 disabled:opacity-40"
        >
          <Trash2 className="size-4" /> Remove
        </button>
      </div>
    </div>
  );
}
