import { z } from "zod";
import { parseYoutubeVideoId } from "./youtube";

const blockId = z.string().trim().min(1).max(64);
const nonEmpty = z.string().trim().min(1);

export const textBlockSchema = z.object({
  type: z.literal("text"),
  id: blockId,
  markdown: z.string().max(20_000),
});

export const imageBlockSchema = z.object({
  type: z.literal("image"),
  id: blockId,
  src: z.string().trim().min(1).max(2_000),
  alt: z.string().trim().min(1).max(280),
  attribution: z.string().trim().max(280).optional(),
  assetId: z.string().trim().min(1).max(64).optional(),
});

export const quoteBlockSchema = z.object({
  type: z.literal("quote"),
  id: blockId,
  text: nonEmpty.max(2_000),
  source: nonEmpty.max(280),
  citation: z.string().trim().max(280).optional(),
});

export const glossaryTermSchema = z.object({
  term: nonEmpty.max(80),
  definition: nonEmpty.max(500),
});

export const glossaryBlockSchema = z.object({
  type: z.literal("glossary"),
  id: blockId,
  terms: z.array(glossaryTermSchema).min(1).max(30),
});

export const videoBlockSchema = z.object({
  type: z.literal("video"),
  id: blockId,
  youtubeUrl: z.string().trim().max(500).optional(),
  youtubeVideoId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{11}$/)
    .nullable()
    .optional(),
  transcript: z.string().trim().max(20_000).optional(),
  title: z.string().trim().max(160).optional(),
});

export const checkpointBlockSchema = z.object({
  type: z.literal("checkpoint"),
  id: blockId,
  prompt: nonEmpty.max(500),
  answerHint: z.string().trim().max(500).optional(),
});

export const lessonBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  quoteBlockSchema,
  glossaryBlockSchema,
  videoBlockSchema,
  checkpointBlockSchema,
]);

export const lessonBlocksSchema = z
  .array(lessonBlockSchema)
  .max(40)
  .superRefine((blocks, ctx) => {
    blocks.forEach((block, index) => {
      if (block.type !== "video") return;
      const fromUrl = block.youtubeUrl?.trim()
        ? parseYoutubeVideoId(block.youtubeUrl)
        : null;
      const id = fromUrl ?? block.youtubeVideoId ?? null;
      if (!id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Video blocks need a valid YouTube URL or video id",
          path: [index, "youtubeUrl"],
        });
      }
    });
  });

export type LessonBlock = z.infer<typeof lessonBlockSchema>;
export type LessonBlocks = z.infer<typeof lessonBlocksSchema>;

export function describeLessonBlocksIssue(blocks: unknown): string | null {
  const parsed = lessonBlocksSchema.safeParse(blocks);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return "This lesson is not ready to save yet.";
    const index = typeof issue.path[0] === "number" ? issue.path[0] : null;
    const type =
      index != null && Array.isArray(blocks)
        ? (blocks[index] as { type?: string } | undefined)?.type
        : undefined;
    if (type === "image") {
      return "Add a picture and alt text before saving this image.";
    }
    if (type === "quote") {
      return "Add the quoted text and a source before saving.";
    }
    if (type === "glossary") {
      return "Each glossary row needs a term and a definition.";
    }
    if (type === "video" || issue.path.includes("youtubeUrl")) {
      return "Add a valid YouTube URL before saving this video.";
    }
    if (type === "checkpoint") {
      return "Write the checkpoint question before saving.";
    }
    return issue.message;
  }
  return rejectUnsafeLessonEmbeds(parsed.data);
}

const UNSAFE_EMBED =
  /<(?:iframe|script|object|embed)\b|javascript:|data:text\/html/i;

export function rejectUnsafeLessonEmbeds(blocks: LessonBlocks): string | null {
  for (const block of blocks) {
    if (block.type === "image") {
      const src = block.src.trim();
      if (
        !src.startsWith("https://") &&
        !src.startsWith("data:image/") &&
        !src.startsWith("/api/") &&
        !src.startsWith("/teach/")
      ) {
        return `Image “${block.alt}” uses an unsupported source`;
      }
      if (UNSAFE_EMBED.test(src)) {
        return `Image “${block.alt}” contains an unsafe embed`;
      }
    }
    if (block.type === "video") {
      const id =
        (block.youtubeUrl?.trim()
          ? parseYoutubeVideoId(block.youtubeUrl)
          : null) ?? block.youtubeVideoId;
      if (!id) return "Video block has an invalid YouTube reference";
    }
    if (block.type === "text" && UNSAFE_EMBED.test(block.markdown)) {
      return "Text blocks cannot include raw embeds or scripts";
    }
  }
  return null;
}

export function blocksToMarkdown(blocks: LessonBlocks): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        parts.push(block.markdown.trim());
        break;
      case "image":
        parts.push(
          `![${block.alt}](${block.src})${
            block.attribution ? `\n*${block.attribution}*` : ""
          }`,
        );
        break;
      case "quote":
        parts.push(
          `> ${block.text.replace(/\n/g, "\n> ")}\n>\n> — ${block.source}${
            block.citation ? ` (${block.citation})` : ""
          }`,
        );
        break;
      case "glossary":
        parts.push(
          block.terms
            .map((term: { term: string; definition: string }) =>
              `**${term.term}** — ${term.definition}`,
            )
            .join("\n\n"),
        );
        break;
      case "video": {
        const id =
          (block.youtubeUrl?.trim()
            ? parseYoutubeVideoId(block.youtubeUrl)
            : null) ?? block.youtubeVideoId;
        parts.push(
          [
            block.title ? `### ${block.title}` : "### Video",
            id ? `Watch: https://www.youtube.com/watch?v=${id}` : "",
            block.transcript?.trim()
              ? `Transcript:\n\n${block.transcript.trim()}`
              : "_Transcript unavailable — ask your teacher for an alternate._",
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
        break;
      }
      case "checkpoint":
        parts.push(
          `#### Checkpoint\n\n${block.prompt}${
            block.answerHint ? `\n\n_Hint: ${block.answerHint}_` : ""
          }`,
        );
        break;
    }
  }
  return parts.filter(Boolean).join("\n\n").trim();
}

export function primaryYoutubeIdFromBlocks(
  blocks: LessonBlocks,
): string | null {
  for (const block of blocks) {
    if (block.type !== "video") continue;
    const fromUrl = block.youtubeUrl?.trim()
      ? parseYoutubeVideoId(block.youtubeUrl)
      : null;
    return fromUrl ?? block.youtubeVideoId ?? null;
  }
  return null;
}

export function markdownToStarterBlocks(markdown: string): LessonBlocks {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return [
      {
        type: "text",
        id: "text-1",
        markdown: "",
      },
    ];
  }
  return [
    {
      type: "text",
      id: "text-1",
      markdown: trimmed,
    },
  ];
}

export function newBlockId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
