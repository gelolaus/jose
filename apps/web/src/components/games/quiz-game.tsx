"use client";

import type { QuizGame } from "@jose/shared";
import { useState } from "react";

export function QuizGame({
  game,
  disabled,
  onFinish,
}: {
  game: QuizGame;
  disabled: boolean;
  onFinish: (score: number, maxScore: number, payload?: unknown) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const question = game.questions[index]!;
  const last = index === game.questions.length - 1;

  function choose(choiceIndex: number) {
    if (picked !== null || disabled) return;
    setPicked(choiceIndex);
    if (choiceIndex === question.correctIndex) {
      setCorrectCount((n) => n + 1);
    }
  }

  function next() {
    if (picked === null) return;
    if (last) {
      onFinish(correctCount, game.questions.length);
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
      <p className="font-display text-2xl font-semibold text-slate-800 sm:text-3xl">
        {question.prompt}
      </p>
      <ul className="space-y-2.5">
        {question.choices.map((choice, i) => {
          const selected = picked === i;
          const right = i === question.correctIndex;
          let tone = "bg-white ring-black/10 hover:bg-violet-50";
          if (picked !== null && selected && right) tone = "bg-emerald-100 ring-emerald-300";
          else if (picked !== null && selected && !right) tone = "bg-rose-100 ring-rose-300";
          else if (picked !== null && right) tone = "bg-emerald-50 ring-emerald-200";
          return (
            <li key={`${i}-${choice}`}>
              <button
                type="button"
                disabled={picked !== null || disabled}
                onClick={() => choose(i)}
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
          {last ? "See score" : "Next"}
        </button>
      ) : null}
    </div>
  );
}
