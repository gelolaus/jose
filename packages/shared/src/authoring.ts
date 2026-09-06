import { z } from "zod";
import { emptyGameContent, parseGameContent, quizQuestionSchema, type GameContent } from "./games";
import type { LessonBlocks } from "./lesson-blocks";
import { gameTypeSchema, hexColorSchema } from "./path";

export const moduleTemplateIdSchema = z.enum([
  "lesson-retrieval",
  "source-investigation",
  "timeline",
  "chapter-checkpoint",
]);

export type ModuleTemplateId = z.infer<typeof moduleTemplateIdSchema>;

export const moduleTemplateMetaSchema = z.object({
  id: moduleTemplateIdSchema,
  title: z.string(),
  summary: z.string(),
  sectionTitle: z.string(),
  sectionSubtitle: z.string(),
});

export type ModuleTemplateMeta = z.infer<typeof moduleTemplateMetaSchema>;

export type TemplateLevelSeed =
  | {
      title: string;
      kind: "lesson";
      blocks: LessonBlocks;
    }
  | {
      title: string;
      kind: "game";
      gameType: GameContent["type"];
      game: GameContent;
    };

export type ModuleTemplateDefinition = ModuleTemplateMeta & {
  levels: TemplateLevelSeed[];
};

function quiz(prompt: string, choices: string[], correctIndex: number, why: string) {
  return { prompt, choices, correctIndex, why };
}

export const MODULE_TEMPLATES: ModuleTemplateDefinition[] = [
  {
    id: "lesson-retrieval",
    title: "Lesson + retrieval",
    summary: "A short illustrated lesson followed by a five-question quiz.",
    sectionTitle: "Learn and check",
    sectionSubtitle: "Read, then retrieve the key ideas",
    levels: [
      {
        title: "Lesson",
        kind: "lesson",
        blocks: [
          {
            type: "text",
            id: "intro",
            markdown:
              "## What happened?\n\nWrite two short paragraphs that set the scene. Keep one clear objective for learners.",
          },
          {
            type: "quote",
            id: "source-quote",
            text: "Add a primary-source sentence here.",
            source: "Source title",
            citation: "Year / archive",
          },
          {
            type: "checkpoint",
            id: "think",
            prompt: "In one sentence, what should a learner remember from this lesson?",
            answerHint: "Restate the objective in plain words.",
          },
        ],
      },
      {
        title: "Retrieval quiz",
        kind: "game",
        gameType: "quiz",
        game: parseGameContent({
          type: "quiz",
          questions: [
            quiz("What is the main claim of this lesson?", ["Claim A", "Claim B", "Claim C"], 0, "Return to the lesson objective."),
            quiz("Which source supports the claim?", ["Primary quote", "Guesswork", "Unrelated map"], 0, "Cite the source block."),
            quiz("What should learners do next?", ["Explain it", "Skip ahead", "Ignore sources"], 0, "Retrieval prepares explanation."),
            quiz("Which detail is a misconception?", ["Accurate date", "Wrong place", "Correct name"], 1, "Trap the common mix-up."),
            quiz("How would you check your answer?", ["Re-read the source", "Ask a stranger", "Invent a date"], 0, "Point back to evidence."),
          ],
        }),
      },
    ],
  },
  {
    id: "source-investigation",
    title: "Source investigation",
    summary: "Examine a quoted source, build glossary terms, then sort evidence.",
    sectionTitle: "Investigate",
    sectionSubtitle: "Read closely, name terms, sort claims",
    levels: [
      {
        title: "Source close read",
        kind: "lesson",
        blocks: [
          {
            type: "text",
            id: "brief",
            markdown:
              "## Case brief\n\nGive learners a question they can answer only by examining the source.",
          },
          {
            type: "quote",
            id: "exhibit",
            text: "Paste the excerpt learners must examine.",
            source: "Document name",
            citation: "Repository / page",
          },
          {
            type: "glossary",
            id: "terms",
            terms: [
              { term: "Term 1", definition: "Plain-language definition" },
              { term: "Term 2", definition: "Why it matters in this case" },
            ],
          },
          {
            type: "image",
            id: "exhibit-image",
            src: "https://placehold.co/800x450/png?text=Source+image",
            alt: "Describe the source image for screen readers",
            attribution: "Replace with a rights-cleared image and attribution",
          },
        ],
      },
      {
        title: "Sort the evidence",
        kind: "game",
        gameType: "sort",
        game: parseGameContent({
          type: "sort",
          buckets: [
            { id: "supports", label: "Supports the claim" },
            { id: "challenges", label: "Challenges the claim" },
          ],
          items: [
            {
              id: "e1",
              label: "Evidence item 1",
              bucketId: "supports",
              why: "Explain why this supports the claim.",
            },
            {
              id: "e2",
              label: "Evidence item 2",
              bucketId: "challenges",
              why: "Explain why this challenges the claim.",
            },
            {
              id: "e3",
              label: "Evidence item 3",
              bucketId: "supports",
            },
            {
              id: "e4",
              label: "Evidence item 4",
              bucketId: "challenges",
            },
          ],
        }),
      },
    ],
  },
  {
    id: "timeline",
    title: "Timeline chapter",
    summary: "A context lesson plus a cause-and-consequence timeline.",
    sectionTitle: "Through time",
    sectionSubtitle: "Order events and explain links",
    levels: [
      {
        title: "Context",
        kind: "lesson",
        blocks: [
          {
            type: "text",
            id: "context",
            markdown:
              "## Before you order events\n\nName the people, places, and stakes. Keep the list short.",
          },
          {
            type: "video",
            id: "clip",
            youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            transcript:
              "Replace this placeholder clip and transcript with approved classroom media.",
            title: "Context clip",
          },
        ],
      },
      {
        title: "Cause and consequence",
        kind: "game",
        gameType: "timeline",
        game: parseGameContent({
          type: "timeline",
          items: [
            { id: "t1", label: "First event", year: "1", why: "Why this comes first" },
            { id: "t2", label: "Turning point", year: "2", why: "What changed" },
            { id: "t3", label: "Consequence", year: "3", why: "What followed" },
            { id: "t4", label: "Later echo", year: "4" },
          ],
        }),
      },
    ],
  },
  {
    id: "chapter-checkpoint",
    title: "Chapter checkpoint",
    summary: "A checkpoint lesson and mixed retrieval games to close a chapter.",
    sectionTitle: "Chapter check",
    sectionSubtitle: "Pause, explain, and prove understanding",
    levels: [
      {
        title: "Explain it",
        kind: "lesson",
        blocks: [
          {
            type: "text",
            id: "wrap",
            markdown:
              "## Pause here\n\nAsk learners to explain the chapter objective without looking back.",
          },
          {
            type: "checkpoint",
            id: "oral",
            prompt: "Tell a partner the chapter story in under one minute.",
            answerHint: "Include one source and one consequence.",
          },
        ],
      },
      {
        title: "Fill the blanks",
        kind: "game",
        gameType: "blank",
        game: emptyGameContent("blank") as GameContent,
      },
      {
        title: "Memory check",
        kind: "game",
        gameType: "memory",
        game: emptyGameContent("memory") as GameContent,
      },
    ],
  },
];

export function listModuleTemplateMeta(): ModuleTemplateMeta[] {
  return MODULE_TEMPLATES.map(
    ({ id, title, summary, sectionTitle, sectionSubtitle }) => ({
      id,
      title,
      summary,
      sectionTitle,
      sectionSubtitle,
    }),
  );
}

export function getModuleTemplate(
  id: ModuleTemplateId,
): ModuleTemplateDefinition {
  const found = MODULE_TEMPLATES.find((template) => template.id === id);
  if (!found) {
    throw new Error(`Unknown template ${id}`);
  }
  return found;
}

export const applyTemplateBodySchema = z.object({
  templateId: moduleTemplateIdSchema,
  replaceEmptyStarter: z.boolean().optional(),
});

export const createFromWizardBodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  intendedLearners: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(280),
  coverColor: hexColorSchema.optional(),
  templateId: moduleTemplateIdSchema.optional(),
});

export const importModeSchema = z.enum(["all-or-nothing", "partial"]);

export const questionImportRowSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  choiceA: z.string().trim().min(1).max(200),
  choiceB: z.string().trim().min(1).max(200),
  choiceC: z.string().trim().max(200).optional(),
  choiceD: z.string().trim().max(200).optional(),
  correct: z.union([
    z.enum(["A", "B", "C", "D", "a", "b", "c", "d"]),
    z.number().int().min(0).max(3),
  ]),
  why: z.string().trim().max(280).optional(),
});

export const importQuestionsBodySchema = z.object({
  mode: importModeSchema.default("all-or-nothing"),
  format: z.enum(["json", "csv"]).default("json"),
  rows: z.array(z.unknown()).min(1).max(100).optional(),
  raw: z.string().max(200_000).optional(),
  commit: z.boolean().default(false),
});

export const importRowErrorSchema = z.object({
  row: z.number().int().nonnegative(),
  field: z.string().optional(),
  message: z.string(),
});

export const importQuestionsResultSchema = z.object({
  mode: importModeSchema,
  commit: z.boolean(),
  totalRows: z.number().int().nonnegative(),
  validCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  errors: z.array(importRowErrorSchema),
  preview: z.array(quizQuestionSchema).optional(),
  applied: z.boolean(),
  level: z.unknown().optional(),
});

export type ImportQuestionsBody = z.infer<typeof importQuestionsBodySchema>;
export type ImportQuestionsResult = z.infer<typeof importQuestionsResultSchema>;

export const assetMimeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

export const createAssetBodySchema = z.object({
  filename: z.string().trim().min(1).max(160),
  mime: assetMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_ASSET_BYTES),
  alt: z.string().trim().min(1).max(280),
  attribution: z.string().trim().max(280).optional(),
  dataBase64: z.string().min(1).max(Math.ceil((MAX_ASSET_BYTES * 4) / 3) + 128),
});

export const teachAssetSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  filename: z.string(),
  mime: assetMimeSchema,
  sizeBytes: z.number().int().nonnegative(),
  alt: z.string(),
  attribution: z.string().nullable(),
  src: z.string(),
  createdAt: z.number().int(),
});

export type TeachAsset = z.infer<typeof teachAssetSchema>;

export const duplicateBodySchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export { gameTypeSchema };
