"use client";

import { YoutubeEmbed } from "@/components/youtube-embed";
import type { LessonBlock, LessonBlocks, LessonContent } from "@jose/shared";
import { parseYoutubeVideoId } from "@jose/shared";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export function LessonBlocksView({
  lesson,
  blocks,
}: {
  lesson?: LessonContent | null;
  blocks?: LessonBlocks;
}) {
  const resolved =
    blocks ??
    lesson?.blocks ??
    (lesson
      ? [
          {
            type: "text" as const,
            id: "legacy",
            markdown: lesson.markdown,
          },
          ...(lesson.youtubeVideoId
            ? [
                {
                  type: "video" as const,
                  id: "legacy-video",
                  youtubeVideoId: lesson.youtubeVideoId,
                  transcript: "Transcript not provided yet.",
                },
              ]
            : []),
        ]
      : []);

  return (
    <div className="space-y-5">
      {resolved.map((block) => (
        <LessonBlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "text":
      return (
        <article className="jose-prose text-base font-semibold leading-relaxed text-slate-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {block.markdown || "_Empty text block_"}
          </ReactMarkdown>
        </article>
      );
    case "image":
      return (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            className="max-h-80 w-full rounded-2xl object-cover ring-1 ring-black/10"
            onError={(event) => {
              event.currentTarget.replaceWith(
                Object.assign(document.createElement("p"), {
                  className: "rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900",
                  textContent: `Image unavailable: ${block.alt}`,
                }),
              );
            }}
          />
          <figcaption className="text-sm font-semibold text-slate-600">
            {block.alt}
            {block.attribution ? ` · ${block.attribution}` : ""}
          </figcaption>
        </figure>
      );
    case "quote":
      return (
        <blockquote className="rounded-2xl border-l-4 border-teal-600 bg-teal-50/70 px-4 py-3">
          <p className="font-semibold text-slate-800">{block.text}</p>
          <footer className="mt-2 text-sm font-bold text-slate-600">
            — {block.source}
            {block.citation ? ` (${block.citation})` : ""}
          </footer>
        </blockquote>
      );
    case "glossary":
      return (
        <dl className="space-y-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
          {block.terms.map((term) => (
            <div key={term.term}>
              <dt className="font-extrabold text-slate-800">{term.term}</dt>
              <dd className="text-sm font-semibold text-slate-600">{term.definition}</dd>
            </div>
          ))}
        </dl>
      );
    case "video": {
      const id =
        (block.youtubeUrl?.trim()
          ? parseYoutubeVideoId(block.youtubeUrl)
          : null) ?? block.youtubeVideoId;
      return (
        <div className="space-y-3">
          {block.title ? (
            <h3 className="font-display text-xl font-semibold text-slate-800">
              {block.title}
            </h3>
          ) : null}
          {id ? (
            <YoutubeEmbed videoId={id} />
          ) : (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              Video unavailable. Use the transcript below.
            </p>
          )}
          <details className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
            <summary className="cursor-pointer font-extrabold text-slate-700">
              Transcript / text alternative
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">
              {block.transcript?.trim() ||
                "Transcript unavailable — ask your teacher for an alternate."}
            </p>
          </details>
        </div>
      );
    }
    case "checkpoint":
      return (
        <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-200">
          <p className="text-xs font-extrabold uppercase tracking-wide text-sky-700">
            Checkpoint
          </p>
          <p className="mt-1 font-bold text-slate-800">{block.prompt}</p>
          {block.answerHint ? (
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Hint: {block.answerHint}
            </p>
          ) : null}
        </div>
      );
  }
}
