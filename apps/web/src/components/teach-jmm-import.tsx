"use client";

import { runMutation } from "@/lib/teach-mutations";
import Link from "next/link";
import { useState } from "react";

type PreviewError = { message: string; line: number; column: number };
type PreviewSection = {
  title: string;
  subtitle: string;
  themeColor: string;
  levels: Array<{ kind: string; title: string }>;
};
type PreviewResult = {
  ok: boolean;
  errors: PreviewError[];
  preview?: {
    version: string;
    title: string;
    subtitle: string;
    coverColor: string;
    objectives: string[];
    sections: PreviewSection[];
  };
  stats?: { sectionCount: number; levelCount: number; imageCount: number };
};

type CommitResult = {
  moduleId: string;
  title: string;
  sectionCount: number;
  levelCount: number;
  sourceHash: string;
  jmmVersion: "1";
};

export function TeachJmmImport({
  previewAction,
  commitAction,
}: {
  previewAction?: (source: string) => Promise<PreviewResult>;
  commitAction?: (source: string) => Promise<CommitResult>;
} = {}) {
  const [source, setSource] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CommitResult | null>(null);

  async function defaultPreview(s: string): Promise<PreviewResult> {
    const { previewModuleImport } = await import("@/lib/path-api");
    return previewModuleImport(s) as Promise<PreviewResult>;
  }

  async function defaultCommit(s: string): Promise<CommitResult> {
    const { commitModuleImport } = await import("@/lib/path-api");
    return commitModuleImport(s) as Promise<CommitResult>;
  }

  async function onValidate() {
    setBusy(true);
    setError(null);
    setCreated(null);
    const outcome = await runMutation(() => (previewAction ?? defaultPreview)(source));
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setResult(outcome.data);
  }

  async function onCreateDraft() {
    if (!result?.ok) return;
    if (
      !window.confirm("Create one new draft module? This never edits existing modules.")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await runMutation(() => (commitAction ?? defaultCommit)(source));
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setCreated(outcome.data);
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="jmm-source" className="block text-sm font-extrabold text-[var(--jose-ink-muted)]">
          Paste JMM
        </label>
        <textarea
          id="jmm-source"
          aria-label="Paste JMM"
          rows={16}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder='<<<JoseModule version="1">>>'
          className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-mono text-sm text-slate-800 ring-1 ring-black/10"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !source.trim()}
          onClick={() => void onValidate()}
          className="jose-button disabled:opacity-50"
        >
          {busy ? "Checking…" : "Validate"}
        </button>
        <button
          type="button"
          disabled={busy || !result?.ok}
          onClick={() => void onCreateDraft()}
          className="jose-button jose-button--secondary disabled:opacity-50"
        >
          Create draft
        </button>
        <a
          href="/docs/authoring/jose-module-markup-v1.md"
          className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--jose-teach)]"
        >
          Authoring guide
        </a>
      </div>
      {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
      {result && !result.ok ? (
        <ul className="space-y-1 rounded-2xl bg-white p-4 ring-1 ring-black/10">
          {result.errors.map((e, i) => (
            <li key={i} className="text-sm font-semibold text-rose-700">
              Line {e.line}, col {e.column}: {e.message}
            </li>
          ))}
          {result.errors.length === 0 ? (
            <li className="text-sm font-semibold text-slate-600">Validation failed.</li>
          ) : null}
        </ul>
      ) : null}
      {result?.ok && result.preview ? (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
          <p className="font-display text-xl font-semibold">{result.preview.title}</p>
          <p className="text-sm font-semibold text-slate-600">{result.preview.subtitle}</p>
          {result.stats ? (
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {result.stats.sectionCount} sections · {result.stats.levelCount} levels ·{" "}
              {result.stats.imageCount} images
            </p>
          ) : null}
          <ol className="mt-3 space-y-2">
            {result.preview.sections.map((sec) => (
              <li key={sec.title} className="rounded-xl bg-slate-50 p-3 ring-1 ring-black/5">
                <p className="font-extrabold text-slate-800">{sec.title}</p>
                <p className="text-sm font-semibold text-slate-600">{sec.subtitle}</p>
                <ul className="mt-1 list-disc pl-5 text-sm font-semibold text-slate-700">
                  {sec.levels.map((lvl) => (
                    <li key={`${sec.title}-${lvl.title}`}>
                      [{lvl.kind}] {lvl.title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {created ? (
        <p className="text-sm font-bold text-emerald-700">
          Draft created: {created.title} ·{" "}
          <Link href={`/teach/modules/${created.moduleId}`} className="underline">
            Open workspace
          </Link>
        </p>
      ) : null}
    </div>
  );
}
