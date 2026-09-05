"use client";

import {
  gradeCaseFiles,
  type CaseFilesGame as CaseContent,
} from "@jose/shared";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { PlayBoardProps } from "./play-types";

export function CaseFilesGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: CaseContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: CaseContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <CaseFilesBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <CaseFilesPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
    />
  );
}

function CaseFilesPlay({
  game,
  disabled,
  onMiss,
  onFinish,
}: { game: CaseContent } & PlayBoardProps) {
  const [openId, setOpenId] = useState(game.sources[0]?.id ?? null);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [conclusionId, setConclusionId] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const missesRef = useRef(0);

  function toggleEvidence(id: string) {
    if (disabled || done) return;
    setEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (disabled || done || !conclusionId) return;
    const result = gradeCaseFiles(game, {
      evidenceIds,
      conclusionId,
      reasoning,
    });
    setFeedback(result.feedback);
    if (result.ok) {
      setDone(true);
      onFinish(result.score, result.maxScore, missesRef.current);
      return;
    }
    missesRef.current += 1;
    await onMiss({ title: "Case feedback", body: result.feedback });
  }

  const open = game.sources.find((source) => source.id === openId) ?? null;

  return (
    <div className="space-y-4">
      {game.approvalStatus === "draft" ? (
        <p
          className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 ring-1 ring-amber-200"
          role="status"
        >
          Draft source pack — replace excerpts before classroom publish.
        </p>
      ) : null}
      <div className="rounded-[1.6rem] bg-slate-900 px-4 py-5 text-white">
        <p className="text-xs font-extrabold uppercase tracking-wide text-amber-300">
          Case question
        </p>
        <p className="mt-1 font-display text-xl font-semibold sm:text-2xl">
          {game.question}
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-300">{game.objective}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-2" role="list" aria-label="Source documents">
          {game.sources.map((source) => {
            const active = source.id === openId;
            const tagged = evidenceIds.includes(source.id);
            return (
              <div key={source.id} className="flex gap-2" role="listitem">
                <button
                  type="button"
                  className={`flex-1 rounded-2xl px-3 py-3 text-left text-sm font-extrabold ring-2 ${
                    active
                      ? "bg-emerald-50 ring-emerald-400 text-emerald-950"
                      : "bg-white ring-black/10 text-slate-800"
                  }`}
                  onClick={() => setOpenId(source.id)}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                    {source.kind}
                  </span>
                  {source.title}
                </button>
                <button
                  type="button"
                  aria-pressed={tagged}
                  disabled={disabled || done}
                  onClick={() => toggleEvidence(source.id)}
                  className={`rounded-2xl px-3 py-2 text-xs font-extrabold ${
                    tagged
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {tagged ? "In tray" : "Tag"}
                </button>
              </div>
            );
          })}
        </div>

        <div
          className="min-h-48 rounded-[1.6rem] bg-white px-4 py-4 ring-1 ring-black/10"
          aria-live="polite"
        >
          {open ? (
            <>
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Document viewer
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold text-slate-900">
                {open.title}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {open.citation}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">
                {open.excerpt}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              Open a document to inspect it.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[1.4rem] bg-violet-50 px-4 py-3 ring-1 ring-violet-200">
        <p className="text-xs font-extrabold uppercase tracking-wide text-violet-700">
          Evidence tray
        </p>
        <p className="mt-1 text-sm font-bold text-violet-950">
          {evidenceIds.length
            ? evidenceIds
                .map((id) => game.sources.find((s) => s.id === id)?.title ?? id)
                .join(" · ")
            : "Tag sources that support your conclusion."}
        </p>
      </div>

      <fieldset className="space-y-2" disabled={disabled || done}>
        <legend className="text-sm font-extrabold text-slate-700">
          Conclusion
        </legend>
        {game.conclusions.map((conclusion) => (
          <label
            key={conclusion.id}
            className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-black/10"
          >
            <input
              type="radio"
              name="case-conclusion"
              checked={conclusionId === conclusion.id}
              onChange={() => setConclusionId(conclusion.id)}
              className="mt-1"
            />
            <span className="text-sm font-bold text-slate-800">
              {conclusion.label}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-extrabold text-slate-700">
          {game.reasoningPrompt}
        </span>
        <textarea
          value={reasoning}
          disabled={disabled || done}
          onChange={(e) => setReasoning(e.target.value)}
          rows={3}
          className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>

      <button
        type="button"
        disabled={disabled || done || !conclusionId || evidenceIds.length === 0}
        onClick={() => void submit()}
        className="w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        Submit case
      </button>
      {feedback ? (
        <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 ring-1 ring-black/5">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function CaseFilesBuild({
  game,
  onChange,
}: {
  game: CaseContent;
  onChange: (game: CaseContent) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
        {game.teacherInstructions}
      </p>
      <Field
        label="Approval status"
        value={game.approvalStatus}
        onChange={(approvalStatus) =>
          onChange({
            ...game,
            approvalStatus: approvalStatus === "approved" ? "approved" : "draft",
          })
        }
      />
      <Field
        label="Case question"
        value={game.question}
        onChange={(question) => onChange({ ...game, question })}
      />
      <Field
        label="Objective"
        value={game.objective}
        onChange={(objective) => onChange({ ...game, objective })}
      />
      <Field
        label="Teacher instructions"
        value={game.teacherInstructions}
        onChange={(teacherInstructions) =>
          onChange({ ...game, teacherInstructions })
        }
        multiline
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-slate-700">Sources</p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-white"
            onClick={() =>
              onChange({
                ...game,
                sources: [
                  ...game.sources,
                  {
                    id: `src-${game.sources.length + 1}`,
                    title: "New source — replace",
                    kind: "primary" as const,
                    citation: "[Teacher: citation]",
                    excerpt: "[Paste approved excerpt]",
                  },
                ].slice(0, 5),
              })
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Source
          </button>
        </div>
        {game.sources.map((source, index) => (
          <div
            key={source.id}
            className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-black/10"
          >
            <div className="flex justify-between gap-2">
              <Field
                label="Title"
                value={source.title}
                onChange={(title) => {
                  const sources = [...game.sources];
                  sources[index] = { ...source, title };
                  onChange({ ...game, sources });
                }}
              />
              {game.sources.length > 3 ? (
                <button
                  type="button"
                  aria-label="Remove source"
                  className="self-end rounded-full bg-rose-50 p-2 text-rose-700"
                  onClick={() =>
                    onChange({
                      ...game,
                      sources: game.sources.filter((s) => s.id !== source.id),
                    })
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <Field
              label="Citation"
              value={source.citation}
              onChange={(citation) => {
                const sources = [...game.sources];
                sources[index] = { ...source, citation };
                onChange({ ...game, sources });
              }}
            />
            <Field
              label="Excerpt (approved text only)"
              value={source.excerpt}
              multiline
              onChange={(excerpt) => {
                const sources = [...game.sources];
                sources[index] = { ...source, excerpt };
                onChange({ ...game, sources });
              }}
            />
          </div>
        ))}
      </div>
      <Field
        label="Debrief"
        value={game.debrief}
        multiline
        onChange={(debrief) => onChange({ ...game, debrief })}
      />
      <Field
        label="Accepted evidence JSON (conclusionId → arrays of source id sets)"
        value={JSON.stringify(game.acceptedEvidenceByConclusion, null, 2)}
        multiline
        onChange={(raw) => {
          try {
            onChange({
              ...game,
              acceptedEvidenceByConclusion: JSON.parse(raw) as CaseContent["acceptedEvidenceByConclusion"],
            });
          } catch {
            /* keep typing */
          }
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block w-full space-y-1">
      <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      )}
    </label>
  );
}
