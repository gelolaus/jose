"use client";

import type { AssessmentQuiz, QuizGame as QuizContent } from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";

type QuizPlayContent =
  | QuizContent
  | AssessmentQuiz;

function isAuthorQuiz(game: QuizPlayContent): game is QuizContent {
  const q = game.questions[0];
  return Boolean(q && "correctIndex" in q);
}

export function QuizGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onEvaluate,
  onChange,
}: {
  game: QuizPlayContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: QuizContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange && isAuthorQuiz(game)) {
    return <QuizBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <QuizPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
      onEvaluate={onEvaluate}
    />
  );
}

function QuizPlay({
  game,
  disabled,
  onMiss,
  onFinish,
  onEvaluate,
}: { game: QuizPlayContent } & PlayBoardProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealedCorrect, setRevealedCorrect] = useState<number | null>(null);
  const missesRef = useRef(0);
  const choicesRef = useRef<number[]>([]);
  const question = game.questions[index]!;
  const last = index === game.questions.length - 1;
  const author = isAuthorQuiz(game);

  async function choose(choiceIndex: number) {
    if (picked !== null || disabled) return;
    setPicked(choiceIndex);

    if (onEvaluate) {
      const result = await onEvaluate({
        type: "quiz_choice",
        questionIndex: index,
        choiceIndex,
      });
      choicesRef.current[index] = choiceIndex;
      if (result.correct) {
        setRevealedCorrect(choiceIndex);
        return;
      }
      missesRef.current += 1;
      if (result.feedback) {
        const miss = await onMiss(result.feedback);
        if (miss === "empty") return;
      } else {
        await onMiss(null);
      }
      return;
    }

    if (!author) return;
    const right = choiceIndex === question.correctIndex;
    choicesRef.current[index] = choiceIndex;
    if (right) {
      setRevealedCorrect(question.correctIndex);
      return;
    }
    const correct = question.choices[question.correctIndex]!;
    const miss = await onMiss({
      title: correct,
      body: question.why?.trim() || `The right answer is ${correct}.`,
    });
    missesRef.current += 1;
    setRevealedCorrect(question.correctIndex);
    if (miss === "empty") return;
  }

  function next() {
    if (picked === null) return;
    if (last) {
      const answers = {
        type: "quiz" as const,
        choices: game.questions.map((_, i) => choicesRef.current[i] ?? -1),
      };
      onFinish(
        game.questions.length - missesRef.current,
        game.questions.length,
        missesRef.current,
        answers,
      );
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealedCorrect(null);
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
          const right = revealedCorrect !== null && i === revealedCorrect;
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
  const questions = game.questions;

  function patch(next: QuizContent["questions"][number], index: number) {
    const copy = [...questions];
    copy[index] = next;
    onChange({ ...game, questions: copy });
  }

  return (
    <div className="space-y-4">
      {questions.map((question, qi) => (
        <div key={qi} className="space-y-3 rounded-[1.5rem] bg-slate-50 p-4 ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-2">
            <label className="block flex-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Prompt
              <input
                value={question.prompt}
                onChange={(e) => patch({ ...question, prompt: e.target.value }, qi)}
                className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-black/10"
              />
            </label>
            {questions.length > 1 ? (
              <button
                type="button"
                aria-label="Remove question"
                onClick={() =>
                  onChange({
                    ...game,
                    questions: questions.filter((_, i) => i !== qi),
                  })
                }
                className="rounded-full bg-white p-2 text-rose-600 ring-1 ring-black/10"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
          <ul className="space-y-2">
            {question.choices.map((choice, i) => (
              <li key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch({ ...question, correctIndex: i }, qi)}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    question.correctIndex === i
                      ? "bg-emerald-500 text-white"
                      : "bg-white text-slate-500 ring-1 ring-black/10"
                  }`}
                >
                  {question.correctIndex === i ? "✓" : i + 1}
                </button>
                <input
                  value={choice}
                  onChange={(e) => {
                    const choices = [...question.choices];
                    choices[i] = e.target.value;
                    patch({ ...question, choices }, qi);
                  }}
                  className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-black/10"
                />
              </li>
            ))}
          </ul>
          <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Why
            <textarea
              value={question.why ?? ""}
              onChange={(e) => patch({ ...question, why: e.target.value }, qi)}
              rows={2}
              className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-black/10"
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...game,
            questions: [
              ...questions,
              { prompt: "New question", choices: ["A", "B"], correctIndex: 0 },
            ],
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-extrabold text-white"
      >
        <Plus className="size-4" />
        Add question
      </button>
    </div>
  );
}
