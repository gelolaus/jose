"use client";

import {
  shuffledCopy,
  scoreQuizRationale,
  type AssessmentQuiz,
  type QuizGame as QuizContent,
  type QuizQuestion,
} from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
  const [rationaleId, setRationaleId] = useState<string | null>(null);
  const [correctPanel, setCorrectPanel] = useState<WhyPayload | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const missesRef = useRef(0);
  const choicesRef = useRef<(string | number)[]>([]);
  const rationaleRef = useRef<(string | null)[]>([]);
  const { playCue } = useMotionSound();
  const question = game.questions[index]!;
  const last = index === game.questions.length - 1;
  const authored = authoredQuestion(game, index);

  const order = useMemo(() => {
    const ids = question.choices.map((choice) => choice.id);
    const shuffled = shuffledCopy(ids);
    if (shuffled.length > 1 && shuffled.every((id, i) => id === ids[i])) {
      [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
    }
    return shuffled;
  }, [question]);

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
        if (!question.rationales?.length) {
          setCorrectPanel(
            result.feedback
              ? { title: result.feedback.title, body: result.feedback.body, tone: "success" }
              : authored
                ? buildCorrectPanel(authored)
                : null,
          );
        }
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

    if (!authored) return;
    const right = choiceId === authored.correctChoiceId;
    if (right) {
      playCue("accept");
      setRevealedId(authored.correctChoiceId);
      if (!question.rationales?.length) {
        setCorrectPanel(buildCorrectPanel(authored));
      }
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
  }

  async function pickRationale(id: string) {
    if (disabled || rationaleId || pickedId === null) return;
    if (authored && pickedId !== authored.correctChoiceId) return;
    setRationaleId(id);
    rationaleRef.current[index] = id;
    if (onEvaluate) {
      const result = await onEvaluate({
        type: "quiz_rationale",
        questionIndex: index,
        rationaleId: id,
      });
      if (result.correct) {
        playCue("accept");
        setCorrectPanel(
          result.feedback
            ? { title: result.feedback.title, body: result.feedback.body, tone: "success" }
            : authored
              ? buildCorrectPanel(authored)
              : null,
        );
        return;
      }
      missesRef.current += 1;
      playCue("reject");
      if (result.feedback) {
        await onMiss({
          title: result.feedback.title,
          body: result.feedback.body,
          tone: "miss",
        });
      }
      return;
    }
    if (!authored) return;
    const scored = scoreQuizRationale(authored, id);
    if (scored.scored && !scored.correct) {
      missesRef.current += 1;
      playCue("reject");
      const right = authored.rationales?.find((item) => item.id === authored.correctRationaleId);
      await onMiss({
        title: right?.text ?? "Stronger reason",
        body: authored.why?.trim() || "Pick the reason that ties the evidence to the claim.",
        tone: "miss",
      });
      return;
    }
    playCue("accept");
    setCorrectPanel(buildCorrectPanel(authored));
  }

  function next() {
    if (pickedId === null) return;
    if (question.rationales?.length && !rationaleId) {
      const needs =
        Boolean(onEvaluate) ||
        (authored && pickedId === authored.correctChoiceId);
      if (needs) return;
    }
    if (last) {
      onFinish(
        game.questions.length - missesRef.current,
        game.questions.length,
        missesRef.current,
        {
          type: "quiz",
          choices: game.questions.map((_, i) => choicesRef.current[i] ?? ""),
          rationales: rationaleRef.current.length
            ? game.questions.map((_, i) => rationaleRef.current[i] ?? null)
            : undefined,
        },
      );
      return;
    }
    setIndex((i) => i + 1);
    setPickedId(null);
    setRationaleId(null);
    setCorrectPanel(null);
    setRevealedId(null);
  }

  const needsRationale = Boolean(question.rationales?.length) && pickedId !== null && (
    Boolean(onEvaluate) || (authored != null && pickedId === authored.correctChoiceId)
  );
  const canAdvance =
    pickedId !== null && (!needsRationale || rationaleId !== null);

  return (
    <GameBoard scene="quiz" step={`Question ${index + 1} of ${game.questions.length}`}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-[var(--jose-text-muted)]">
          Question {index + 1} of {game.questions.length}
        </p>
        <p className="rounded-full bg-[var(--jose-surface-control)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--jose-text)]">
          {question.kind === "evidence" ? "Evidence duel" : "Quick check"}
        </p>
      </div>
      {question.kind === "evidence" && question.claim ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 ring-1 ring-amber-200">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700">Claim</p>
          <p className="mt-1">{question.claim}</p>
        </div>
      ) : null}
      <div className="rounded-[1.8rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-8 text-center shadow-lg sm:px-8">
        <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
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
            "bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-[var(--jose-rule)] hover:ring-violet-400 node-3d motion-control";
          if (pickedId !== null && selected && right)
            tone = "bg-emerald-700 text-white ring-emerald-800 motion-accept";
          else if (pickedId !== null && selected && !right)
            tone = "bg-rose-800 text-white ring-rose-900 snap-back";
          else if (pickedId !== null && right)
            tone = "bg-emerald-700/20 text-emerald-950 ring-emerald-700";
          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={pickedId !== null || disabled}
                onClick={() => void choose(choice.id)}
                className={`w-full rounded-3xl px-4 py-3.5 text-left text-base font-extrabold ring-2 disabled:bg-[var(--jose-surface-control)] ${tone}`}
              >
                {choice.text}
              </button>
            </li>
          );
        })}
      </ul>
      {needsRationale ? (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Why is this the strongest evidence?
          </p>
          {question.rationales!.map((item) => {
            const on = rationaleId === item.id;
            const right = item.id === (authored?.correctRationaleId ?? rationaleId);
            let tone = "bg-white ring-black/10";
            if (rationaleId && on && right) tone = "bg-emerald-100 ring-emerald-300";
            else if (rationaleId && on && !right) tone = "bg-rose-100 ring-rose-300";
            else if (rationaleId && right) tone = "bg-emerald-50 ring-emerald-200";
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled || rationaleId !== null}
                onClick={() => void pickRationale(item.id)}
                className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm font-bold ring-2 ${tone}`}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      ) : null}
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
      {canAdvance ? (
        <button
          type="button"
          onClick={next}
          disabled={disabled}
          className="w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)]"
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
        Use Quick check for recall. Use Evidence duel for a claim, sources, and a structured reason.
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
      <div className="flex flex-wrap gap-2">
        {(["recall", "evidence"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => patch({ ...question, kind })}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              question.kind === kind ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-900"
            }`}
          >
            {kind === "recall" ? "Quick check" : "Evidence duel"}
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
        Why (miss)
        <textarea
          value={question.why ?? ""}
          onChange={(e) => patch({ ...question, why: e.target.value || undefined })}
          rows={2}
          className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block text-xs font-extrabold text-slate-500">
        Why correct
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
