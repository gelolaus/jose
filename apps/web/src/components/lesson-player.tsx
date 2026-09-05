"use client";

import { YoutubeEmbed } from "@/components/youtube-embed";
import { completeLevel } from "@/lib/path-api";
import type { LessonContent } from "@jose/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export function LessonPlayer({
  levelId,
  moduleId,
  title,
  lesson,
  nextLevelId,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  lesson: LessonContent;
  nextLevelId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeeper, setShowDeeper] = useState(false);
  const editorial = lesson.editorial;

  async function onContinue() {
    setBusy(true);
    setError(null);
    try {
      const result = await completeLevel(levelId);
      const href =
        result.continueHref ??
        (nextLevelId
          ? `/learn/${moduleId}/${nextLevelId}`
          : `/learn/${moduleId}`);
      router.push(href);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
        {title}
      </h1>

      {editorial.objectives.length > 0 ? (
        <section className="rounded-xl border border-[var(--jose-rule)] bg-[var(--jose-wash)] px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--jose-accent)]">
            You should understand
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--jose-ink)]">
            {editorial.objectives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <article className="jose-prose text-base leading-relaxed text-stone-700 sm:text-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {lesson.markdown}
        </ReactMarkdown>
      </article>

      {editorial.interpretationNotes.length > 0 ? (
        <section className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
            Interpretation notes
          </h2>
          <ul className="mt-2 space-y-2 text-sm text-amber-950">
            {editorial.interpretationNotes.map((note) => (
              <li key={note.claim}>
                <span className="font-semibold uppercase tracking-wide">
                  {note.certainty}
                </span>
                : {note.claim} — {note.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editorial.keyVocabulary.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-semibold text-[var(--jose-ink)]">
            Key vocabulary
          </h2>
          <dl className="mt-2 space-y-2">
            {editorial.keyVocabulary.map((entry) => (
              <div key={entry.term}>
                <dt className="font-semibold text-[var(--jose-ink)]">{entry.term}</dt>
                <dd className="text-sm text-[var(--jose-ink-muted)]">
                  {entry.definition}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {editorial.citations.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-semibold text-[var(--jose-ink)]">
            Sources
          </h2>
          <ul className="mt-2 space-y-2 text-sm text-[var(--jose-ink-muted)]">
            {editorial.citations.map((citation) => (
              <li key={citation.label}>
                <span className="font-semibold text-[var(--jose-ink)]">
                  {citation.label}
                </span>
                — {citation.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editorial.deeperAnalysisMarkdown ? (
        <section>
          <button
            type="button"
            className="text-sm font-semibold text-teal-800 underline"
            onClick={() => setShowDeeper((v) => !v)}
          >
            {showDeeper ? "Hide deeper analysis" : "Optional deeper analysis"}
          </button>
          {showDeeper ? (
            <article className="jose-prose mt-3 text-base text-stone-700">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {editorial.deeperAnalysisMarkdown}
              </ReactMarkdown>
            </article>
          ) : null}
        </section>
      ) : null}

      {editorial.contentGaps.length > 0 ? (
        <section className="rounded-xl border border-dashed border-stone-300 bg-white/70 px-4 py-3 text-sm text-stone-600">
          <p className="font-semibold text-stone-800">Content still needed</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {editorial.contentGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {lesson.youtubeVideoId ? (
        <YoutubeEmbed videoId={lesson.youtubeVideoId} />
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-rose-700">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          className="rounded-xl bg-[var(--jose-ink)] px-7 py-3.5 text-base font-semibold text-[var(--jose-paper)] shadow-md disabled:opacity-60"
        >
          {busy ? "Saving…" : nextLevelId ? "Continue to next" : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/learn/${moduleId}`)}
          className="rounded-xl border border-[var(--jose-rule)] bg-white px-5 py-3.5 text-base font-semibold text-[var(--jose-ink)]"
        >
          Back to map
        </button>
      </div>
    </div>
  );
}
