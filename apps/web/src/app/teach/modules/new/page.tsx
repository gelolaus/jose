"use client";

import { COVER_COLORS, FieldLabel, TeachTitle } from "@/components/teach-shell";
import { accessibleColorName, meetsWcagAa } from "@/lib/contrast";
import { createTeachModuleFromWizard, fetchTeachTemplates } from "@/lib/path-api";
import type { ModuleTemplateId, ModuleTemplateMeta } from "@jose/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewModulePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [intendedLearners, setIntendedLearners] = useState("");
  const [objective, setObjective] = useState("");
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]!);
  const [templateId, setTemplateId] = useState<ModuleTemplateId | "">("");
  const [templates, setTemplates] = useState<ModuleTemplateMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTeachTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const created = await createTeachModuleFromWizard({
        title,
        intendedLearners,
        objective,
        coverColor,
        templateId: templateId || undefined,
      });
      router.push(`/teach/modules/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create module");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle kicker="Teach" title="New module" />
      <p className="mb-4 text-sm font-semibold text-slate-600">
        Step {step} of 3 — title, learners, objective, then a starter structure.
      </p>
      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <FieldLabel>Module title</FieldLabel>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
            />
          </div>
          <div>
            <FieldLabel>Intended learners</FieldLabel>
            <input
              required
              value={intendedLearners}
              onChange={(e) => setIntendedLearners(e.target.value)}
              placeholder="e.g. APC RIZLIFE, Grade 9"
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
            />
          </div>
          <button
            type="button"
            disabled={!title.trim() || !intendedLearners.trim()}
            onClick={() => setStep(2)}
            className="rounded-full bg-teal-700 px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-4">
          <div>
            <FieldLabel>Learning objective</FieldLabel>
            <textarea
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={4}
              placeholder="Learners will be able to…"
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
            />
          </div>
          <div>
            <FieldLabel>Cover color</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {COVER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${accessibleColorName(color)}${
                    meetsWcagAa("#ffffff", color, true) ? "" : " (low contrast with white)"
                  }`}
                  onClick={() => setCoverColor(color)}
                  className={`size-10 rounded-2xl ring-2 ${
                    coverColor === color ? "ring-slate-800" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!objective.trim()}
              onClick={() => setStep(3)}
              className="rounded-full bg-teal-700 px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-600">
            Choose a starter structure, or keep the default lesson + quiz.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/10">
            <input
              type="radio"
              name="template"
              checked={templateId === ""}
              onChange={() => setTemplateId("")}
              className="mt-1"
            />
            <span>
              <span className="block font-extrabold text-slate-800">Lesson + quiz starter</span>
              <span className="text-sm font-semibold text-slate-600">
                Empty lesson and quiz ready to fill in the workspace.
              </span>
            </span>
          </label>
          {templates.map((template) => (
            <label
              key={template.id}
              className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/10"
            >
              <input
                type="radio"
                name="template"
                checked={templateId === template.id}
                onChange={() => setTemplateId(template.id)}
                className="mt-1"
              />
              <span>
                <span className="block font-extrabold text-slate-800">{template.title}</span>
                <span className="text-sm font-semibold text-slate-600">
                  {template.summary}
                </span>
              </span>
            </label>
          ))}
          {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="rounded-full bg-teal-700 px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {busy ? "Creating…" : "Open workspace"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
