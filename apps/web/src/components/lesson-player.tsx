"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { LessonBlocksView } from "@/components/lesson-blocks-view";
import { LessonBookmarkButton } from "@/components/lesson-bookmark-button";
import { ExplanationNote, SourceQuote } from "@/components/source-quote";
import { YoutubeEmbed } from "@/components/youtube-embed";
import { completeLevel } from "@/lib/path-api";
import {
  hasSessionReward,
  readSessionReward,
  SessionRewardBeat,
  type SessionReward,
} from "@/components/games/session-reward";
import { emptyLessonEditorial, type LessonContent } from "@jose/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import "./session-play.css";

function realExplanation(lesson: LessonContent): string | null {
  const extra = lesson as LessonContent & { explanation?: unknown };
  const parts: string[] = [];
  if (typeof extra.explanation === "string" && extra.explanation.trim()) {
    parts.push(extra.explanation.trim());
  }
  for (const note of lesson.editorial?.interpretationNotes ?? []) {
    const line = `${note.certainty}: ${note.claim} — ${note.note}`.trim();
    if (line) parts.push(line);
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function realSources(
  lesson: LessonContent,
): { text: string; citation?: string }[] {
  const extra = lesson as LessonContent & {
    source?: unknown;
    sourceQuote?: unknown;
    sourceCitation?: unknown;
  };
  const sources: { text: string; citation?: string }[] = [];
  if (typeof extra.sourceQuote === "string" && extra.sourceQuote.trim()) {
    const citation =
      typeof extra.sourceCitation === "string" && extra.sourceCitation.trim()
        ? extra.sourceCitation.trim()
        : undefined;
    sources.push({ text: extra.sourceQuote.trim(), citation });
  } else if (typeof extra.source === "string" && extra.source.trim()) {
    sources.push({ text: extra.source.trim() });
  } else if (extra.source && typeof extra.source === "object") {
    const source = extra.source as {
      text?: unknown;
      excerpt?: unknown;
      citation?: unknown;
      label?: unknown;
    };
    const text =
      typeof source.text === "string"
        ? source.text
        : typeof source.excerpt === "string"
          ? source.excerpt
          : "";
    if (text.trim()) {
      const citation =
        typeof source.citation === "string"
          ? source.citation
          : typeof source.label === "string"
            ? source.label
            : undefined;
      sources.push({
        text: text.trim(),
        citation: citation?.trim() || undefined,
      });
    }
  }
  for (const citation of lesson.editorial?.citations ?? []) {
    if (!citation.detail.trim()) continue;
    sources.push({ text: citation.detail.trim(), citation: citation.label });
  }
  return sources;
}

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
  const [reward, setReward] = useState<SessionReward | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const editorial = lesson.editorial ?? emptyLessonEditorial();
  const useBlocks = Boolean(lesson.blocks && lesson.blocks.length > 0);
  const explanation = realExplanation(lesson);
  const sources = realSources(lesson);

  function goToMap() {
    router.push(`/learn/${moduleId}`);
  }

  async function onContinue() {
    if (pendingHref) {
      setBusy(true);
      router.push(pendingHref);
      router.refresh();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await completeLevel(levelId);
      const href =
        result.continueHref ??
        (nextLevelId
          ? `/learn/${moduleId}/${nextLevelId}`
          : `/learn/${moduleId}`);
      const earned = readSessionReward(result);
      if (hasSessionReward(earned)) {
        setReward(earned);
        setPendingHref(href);
        setBusy(false);
        return;
      }
      router.push(href);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
      setBusy(false);
    }
  }

  return (
    <div className="session-play">
      <div className="session-play__scroll">
        <button type="button" className="session-play__back" onClick={goToMap}>
          Back to map
        </button>
        {reward ? (
          <SessionRewardBeat reward={reward} />
        ) : (
          <div className="flex flex-col gap-6">
            <Breadcrumbs
              items={[
                { href: "/learn", label: "Learn" },
                { href: `/learn/${moduleId}`, label: "Path" },
                { label: title },
              ]}
            />
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
              {title}
            </h1>
            <LessonBookmarkButton levelId={levelId} />

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

            {useBlocks ? (
              <LessonBlocksView lesson={lesson} />
            ) : (
              <article className="jose-prose text-base leading-relaxed text-stone-700 sm:text-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {lesson.markdown}
                </ReactMarkdown>
              </article>
            )}

            {explanation ? (
              <ExplanationNote>
                {explanation.split("\n\n").map((part, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {part}
                  </p>
                ))}
              </ExplanationNote>
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

            {sources.map((source) => (
              <SourceQuote
                key={`${source.citation ?? "source"}:${source.text}`}
                citation={source.citation}
              >
                {source.text}
              </SourceQuote>
            ))}

            {editorial.deeperAnalysisMarkdown ? (
              <section>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#12122e] underline"
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

            {!useBlocks && lesson.youtubeVideoId ? (
              <YoutubeEmbed videoId={lesson.youtubeVideoId} />
            ) : null}
          </div>
        )}
      </div>
      <div className="session-play__footer">
        {error ? (
          <p className="mb-2 text-sm font-semibold text-[#7a1a2e]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void onContinue()}
          disabled={busy}
          className="jose-button session-play__continue"
        >
          {busy && !pendingHref ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
