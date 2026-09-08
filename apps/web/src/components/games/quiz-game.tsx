"use client";

import {
  shuffledCopy,
  type AssessmentQuiz,
  type QuizGame as QuizContent,
  type QuizQuestion,
} from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMotionSound } from "@/lib/motion-sound";
import { GameBoard } from "./game-board";
import type { PlayBoardProps, WhyPayload } from "./play-types";

type QuizPlayContent = QuizContent | AssessmentQuiz;

function isAuthorQuiz(game: QuizPlayContent): game is QuizContent {
  const q = game.questions[0];
  return Boolean(q && "correctChoiceId" in q);
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

function authoredQuestion(game: QuizPlayContent, index: number): QuizQuestion | null {
  if (!isAuthorQuiz(game)) return null;
  return game.questions[index] ?? null;
}

function QuizPlay({
  game,
  disabled,
  onMiss,
  onFinish,
  onEvaluate,
}: { game: QuizPlayContent } & PlayBoardProps) {
  const [index, setIndex] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [answerReady, setAnswerReady] = useState(false);
  const [correctPanel, setCorrectPanel] = useState<WhyPayload | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const missesRef = useRef(0);
  const choicesRef = useRef<(string | number)[]>([]);
  const { playCue } = useMotionSound();
  const question = game.questions[index]!;
  const last = index === game.questions.length - 1;
  const authored = authoredQuestion(game, index);

  // Keep server and initial client markup identical, then shuffle once per game.
  const [orders, setOrders] = useState(() =>
    game.questions.map((entry) => entry.choices.map((choice) => choice.id)),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrders(game.questions.map((entry) => {
        const ids = entry.choices.map((choice) => choice.id);
        const shuffled = shuffledCopy(ids);
        if (shuffled.length > 1 && shuffled.every((id, i) => id === ids[i])) {
          [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
        }
        return shuffled;
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game]);
  const order = orders[index] ?? question.choices.map((choice) => choice.id);

  const orderedChoices = order
    .map((id) => question.choices.find((choice) => choice.id === id))
    .filter(Boolean);

  function buildCorrectPanel(q: QuizQuestion): WhyPayload | null {
    if (!q.whyCorrect?.trim() && !q.sources?.length) return null;
    const source =
      q.sources?.find((entry) => entry.id === q.correctChoiceId) ?? q.sources?.[0];
    return {
      title: "Why this is right",
      body:
        q.whyCorrect?.trim() ||
        source?.excerpt ||
        "This choice is the strongest match for the claim.",
      tone: "success",
      sourceLabel: source?.citation || source?.label,
    };
  }

  async function choose(choiceId: string) {
    if (pickedId !== null || disabled) return;
    setPickedId(choiceId);
    choicesRef.current[index] = choiceId;

    if (onEvaluate) {
      const result = await onEvaluate({
        type: "quiz_choice",
        questionIndex: index,
        choiceId,
      });
      if (result.correct) {
        playCue("accept");
        setRevealedId(choiceId);
        setAnswerReady(true);
        setCorrectPanel(
          result.feedback
            ? { title: result.feedback.title, body: result.feedback.body, tone: "success" }
            : authored
              ? buildCorrectPanel(authored)
              : null,
        );
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
        const miss = await onMiss(null);
        if (miss === "empty") return;
      }
      setAnswerReady(true);
      return;
    }

    if (!authored) return;
    const right = choiceId === authored.correctChoiceId;
    if (right) {
      playCue("accept");
      setRevealedId(authored.correctChoiceId);
      setCorrectPanel(buildCorrectPanel(authored));
      setAnswerReady(true);
      return;
    }
    playCue("reject");
    const correct = authored.choices.find((choice) => choice.id === authored.correctChoiceId);
    const source = authored.sources?.find((entry) => entry.id === authored.correctChoiceId);
    const result = await onMiss({
      title: correct?.text ?? "Correct evidence",
      body:
        authored.why?.trim() ||
        `The strongest answer is ${correct?.text ?? "the marked choice"}.`,
      tone: "miss",
      sourceLabel: source?.citation || source?.label,
    });
    missesRef.current += 1;
    setRevealedId(authored.correctChoiceId);
    if (result === "empty") return;
    setAnswerReady(true);
  }

  function next() {
    if (!answerReady || disabled) return;
    if (last) {
      onFinish(
        game.questions.length - missesRef.current,
        game.questions.length,
        missesRef.current,
        {
          type: "quiz",
          choices: game.questions.map((_, i) => choicesRef.current[i] ?? ""),
        },
      );
      return;
    }
    setIndex((i) => i + 1);
    setPickedId(null);
    setAnswerReady(false);
    setCorrectPanel(null);
    setRevealedId(null);
  }

  return (
    <GameBoard scene="quiz" step={`Question ${index + 1} of ${game.questions.length}`}>
    <div className="space-y-5">
      {question.kind === "evidence" && question.claim ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 ring-1 ring-amber-200">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700">Claim</p>
          <p className="mt-1">{question.claim}</p>
        </div>
      ) : null}
      <div className="quiz-prompt">
        <p className="font-display text-2xl font-extrabold text-[var(--jose-text)] sm:text-3xl">
          {question.prompt}
        </p>
      </div>
      {question.kind === "evidence" && question.sources?.length ? (
        <ul className="space-y-2">
          {question.sources.map((source) => (
            <li
              key={source.id}
              className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 ring-1 ring-black/10"
            >
              <p className="font-extrabold text-slate-900">{source.label}</p>
              {source.excerpt ? (
                <p className="mt-1 text-slate-600">“{source.excerpt}”</p>
              ) : null}
              {source.citation ? (
                <p className="mt-1 text-xs font-bold text-slate-500">{source.citation}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="space-y-2.5">
        {orderedChoices.map((choice) => {
          if (!choice) return null;
          const selected = pickedId === choice.id;
          const right = choice.id === (authored?.correctChoiceId ?? revealedId);
          let tone =
            "quiz-answer--idle motion-control";
          if (pickedId !== null && selected && right)
            tone = "quiz-answer--correct motion-accept";
          else if (pickedId !== null && selected && !right)
            tone = "quiz-answer--miss snap-back";
          else if (pickedId !== null && right)
            tone = "quiz-answer--correct";
          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={pickedId !== null || disabled}
                onClick={() => void choose(choice.id)}
                className={`quiz-answer w-full px-5 py-4 text-left text-base font-extrabold ${tone}`}
              >
                {choice.text}
              </button>
            </li>
          );
        })}
      </ul>
      {correctPanel ? (
        <div className="motion-artifact rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 ring-1 ring-emerald-200">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
            {correctPanel.title}
          </p>
          <p className="mt-1 whitespace-pre-line">{correctPanel.body}</p>
          {correctPanel.sourceLabel ? (
            <p className="mt-2 text-xs font-bold text-emerald-800">
              Source: {correctPanel.sourceLabel}
            </p>
          ) : null}
        </div>
      ) : null}
      {answerReady ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="jose-button w-full"
        >
          {last ? "See stars" : "Next"}
        </button>
      ) : null}
    </div>
    </GameBoard>
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

  function patch(next: QuizQuestion) {
    const questions = [...game.questions];
    questions[index] = next;
    onChange({ ...game, questions });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-500">
        Write a question, add choices, and mark one correct answer.
      </p>
      <div className="flex flex-wrap gap-2">
        {game.questions.map((q, i) => (
          <button
            key={q.id}
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
      {question.kind === "evidence" ? (
        <label className="block text-xs font-extrabold text-slate-500">
          Claim
          <textarea
            value={question.claim ?? ""}
            onChange={(e) => patch({ ...question, claim: e.target.value || undefined })}
            rows={2}
            className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
          />
        </label>
      ) : null}
      <ul className="space-y-2">
        {question.choices.map((choice, i) => (
          <li key={choice.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => patch({ ...question, correctChoiceId: choice.id })}
              className={`size-10 shrink-0 rounded-full text-xs font-extrabold ring-2 ${
                question.correctChoiceId === choice.id
                  ? "bg-emerald-500 text-white ring-emerald-600"
                  : "bg-white text-slate-500 ring-black/10"
              }`}
            >
              {question.correctChoiceId === choice.id ? "✓" : i + 1}
            </button>
            <input
              value={choice.text}
              onChange={(e) => {
                const choices = question.choices.map((entry) =>
                  entry.id === choice.id ? { ...entry, text: e.target.value } : entry,
                );
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
        onClick={() => {
          const id = `${question.id}-c${question.choices.length + 1}`;
          patch({
            ...question,
            choices: [...question.choices, { id, text: `Choice ${question.choices.length + 1}` }],
          });
        }}
      >
        Add choice
      </button>
      <label className="block text-xs font-extrabold text-slate-500">
        Feedback after a wrong answer
        <textarea
          value={question.why ?? ""}
          onChange={(e) => patch({ ...question, why: e.target.value || undefined })}
          rows={2}
          className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block text-xs font-extrabold text-slate-500">
        Feedback after a correct answer
        <textarea
          value={question.whyCorrect ?? ""}
          onChange={(e) => patch({ ...question, whyCorrect: e.target.value || undefined })}
          rows={2}
          className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block text-xs font-extrabold text-slate-500">
        Objective tags (comma separated)
        <input
          value={(question.objectiveTags ?? []).join(", ")}
          onChange={(e) =>
            patch({
              ...question,
              objectiveTags: e.target.value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean),
            })
          }
          className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const id = `q${game.questions.length + 1}`;
            onChange({
              ...game,
              questions: [
                ...game.questions,
                {
                  id,
                  kind: "recall",
                  prompt: "New question",
                  choices: [
                    { id: `${id}-c1`, text: "A" },
                    { id: `${id}-c2`, text: "B" },
                  ],
                  correctChoiceId: `${id}-c1`,
                  assessment: "auto",
                },
              ],
            });
          }}
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
