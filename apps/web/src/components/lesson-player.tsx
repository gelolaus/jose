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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
        {title}
      </h1>
      <article className="jose-prose text-base font-semibold leading-relaxed text-slate-700 sm:text-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {lesson.markdown}
        </ReactMarkdown>
      </article>
      {lesson.youtubeVideoId ? (
        <YoutubeEmbed videoId={lesson.youtubeVideoId} />
      ) : null}
      {error ? (
        <p className="text-sm font-bold text-rose-600">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="rounded-full bg-violet-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
