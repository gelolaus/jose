"use client";

import { YoutubeEmbed } from "@/components/youtube-embed";
import { LessonJournalActions } from "@/components/lesson-journal-actions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ExplanationNote, SourceQuote } from "@/components/source-quote";
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
}: {
  levelId: string;
  moduleId: string;
  title: string;
  lesson: LessonContent;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setBusy(true);
    setError(null);
    try {
      await completeLevel(levelId);
      router.push(`/learn/${moduleId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
      setBusy(false);
    }
  }

  const excerptPreview = lesson.markdown.replace(/[#>*_`\[\]]/g, "").slice(0, 180);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { href: "/learn", label: "Learn" },
          { href: `/learn/${moduleId}`, label: "Path" },
          { label: title },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
        {title}
      </h1>
      <LessonJournalActions
        moduleId={moduleId}
        levelId={levelId}
        title={title}
        excerpt={excerptPreview}
      />
      <ExplanationNote>
        Explanations and paraphrases appear in this style. Original historical quotations use the
        amber source block so source wording stays distinguishable from teaching text.
      </ExplanationNote>
      <SourceQuote citation="Preserve original quotations beside any future translation">
        Curated source excerpts will appear here when authors mark them. Do not auto-translate
        assessment keys without editorial review.
      </SourceQuote>
      <article className="jose-prose text-base font-semibold leading-relaxed text-slate-700 sm:text-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {lesson.markdown}
        </ReactMarkdown>
      </article>
      {lesson.youtubeVideoId ? (
        <YoutubeEmbed videoId={lesson.youtubeVideoId} />
      ) : null}
      {error ? (
        <p className="text-sm font-bold text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="min-h-11 rounded-full bg-violet-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
