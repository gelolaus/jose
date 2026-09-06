import { z } from "zod";

export const scaffoldingLevelSchema = z.enum([
  "guided",
  "standard",
  "challenge",
]);

export const instructorReviewStatusSchema = z.enum([
  "unreviewed",
  "needs_revision",
  "reviewed",
]);

export const interpretationCertaintySchema = z.enum([
  "established",
  "disputed",
  "uncertain",
]);

export const vocabularyEntrySchema = z.object({
  term: z.string().trim().min(1).max(80),
  definition: z.string().trim().min(1).max(400),
});

export const citationEntrySchema = z.object({
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
  url: z.string().url().optional(),
});

export const chapterEditorialSchema = z.object({
  objectives: z.array(z.string().trim().min(1).max(240)).max(12),
  keyVocabulary: z.array(vocabularyEntrySchema).max(24),
  instructorReviewStatus: instructorReviewStatusSchema,
  scaffoldingDefault: scaffoldingLevelSchema,
});

export const lessonEditorialSchema = z.object({
  objectives: z.array(z.string().trim().min(1).max(240)).max(8),
  keyVocabulary: z.array(vocabularyEntrySchema).max(16),
  citations: z.array(citationEntrySchema).max(16),
  interpretationNotes: z
    .array(
      z.object({
        claim: z.string().trim().min(1).max(280),
        certainty: interpretationCertaintySchema,
        note: z.string().trim().min(1).max(500),
      }),
    )
    .max(12),
  deeperAnalysisMarkdown: z.string().max(20_000).nullable(),
  scaffoldingLevel: scaffoldingLevelSchema,
  contentGaps: z.array(z.string().trim().min(1).max(280)).max(20),
});

export type ScaffoldingLevel = z.infer<typeof scaffoldingLevelSchema>;
export type InstructorReviewStatus = z.infer<
  typeof instructorReviewStatusSchema
>;
export type ChapterEditorial = z.infer<typeof chapterEditorialSchema>;
export type LessonEditorial = z.infer<typeof lessonEditorialSchema>;

export function emptyChapterEditorial(): ChapterEditorial {
  return {
    objectives: [],
    keyVocabulary: [],
    instructorReviewStatus: "unreviewed",
    scaffoldingDefault: "standard",
  };
}

export function emptyLessonEditorial(): LessonEditorial {
  return {
    objectives: [],
    keyVocabulary: [],
    citations: [],
    interpretationNotes: [],
    deeperAnalysisMarkdown: null,
    scaffoldingLevel: "standard",
    contentGaps: [],
  };
}

/** Editorial structures only — syllabus prose must be supplied by instructors. */
export const CONTENT_OWNER_CHECKLIST = [
  "Map each chapter to the APC RIZLIFE syllabus week/topic codes.",
  "Author measurable chapter objectives (understand / interpret / explain).",
  "Add provenance for every primary source excerpt and illustration.",
  "Provide key vocabulary with definitions suitable for APC + secondary learners.",
  "Label disputed or uncertain interpretations; do not present them as settled fact.",
  "Write optional deeper-analysis prompts that go beyond recall.",
  "Record instructor historical-accuracy review before publishing a chapter.",
  "Replace placeholder seed summaries; current seed is not a complete course.",
] as const;
