import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const quizQuestionSchema = z
  .object({
    prompt: nonEmpty,
    choices: z.array(nonEmpty).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
  })
  .refine((question) => question.correctIndex < question.choices.length, {
    message: "correctIndex is out of range",
    path: ["correctIndex"],
  });

export const quizGameSchema = z.object({
  type: z.literal("quiz"),
  questions: z.array(quizQuestionSchema).min(1),
});

export const memorySideSchema = z
  .object({
    text: z.string().trim().optional(),
    imageUrl: z.string().trim().url().optional(),
  })
  .refine((side) => Boolean(side.text) || Boolean(side.imageUrl), {
    message: "Each card side needs text or an image URL",
  });

export const memoryGameSchema = z.object({
  type: z.literal("memory"),
  pairs: z
    .array(
      z.object({
        a: memorySideSchema,
        b: memorySideSchema,
      }),
    )
    .min(2)
    .max(8),
});

export const timelineGameSchema = z.object({
  type: z.literal("timeline"),
  items: z.array(nonEmpty).min(2).max(12),
});

export const blankItemSchema = z.object({
  sentence: nonEmpty,
  answer: nonEmpty,
  decoys: z.array(nonEmpty).min(1).max(8),
});

export const blankGameSchema = z.object({
  type: z.literal("blank"),
  items: z.array(blankItemSchema).min(1).max(12),
});

export const sortBucketSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
});

export const sortItemSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  bucketId: nonEmpty,
});

export const sortGameSchema = z.object({
  type: z.literal("sort"),
  buckets: z.array(sortBucketSchema).min(2).max(3),
  items: z.array(sortItemSchema).min(2).max(20),
});

export const gameContentSchema = z.union([
  quizGameSchema,
  memoryGameSchema,
  timelineGameSchema,
  blankGameSchema,
  sortGameSchema,
]);

export type QuizGame = z.infer<typeof quizGameSchema>;
export type MemoryGame = z.infer<typeof memoryGameSchema>;
export type TimelineGame = z.infer<typeof timelineGameSchema>;
export type BlankGame = z.infer<typeof blankGameSchema>;
export type SortGame = z.infer<typeof sortGameSchema>;
export type GameContent = z.infer<typeof gameContentSchema>;

export const lessonContentSchema = z.object({
  markdown: z.string(),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;

export function emptyGameContent(
  type: GameContent["type"],
): z.input<typeof gameContentSchema> {
  switch (type) {
    case "quiz":
      return {
        type: "quiz",
        questions: [
          { prompt: "Question", choices: ["Choice A", "Choice B"], correctIndex: 0 },
        ],
      };
    case "memory":
      return {
        type: "memory",
        pairs: [
          { a: { text: "Card A1" }, b: { text: "Card B1" } },
          { a: { text: "Card A2" }, b: { text: "Card B2" } },
        ],
      };
    case "timeline":
      return { type: "timeline", items: ["First", "Second"] };
    case "blank":
      return {
        type: "blank",
        items: [
          {
            sentence: "Rizal was born in ___.",
            answer: "Calamba",
            decoys: ["Manila", "Dapitan"],
          },
        ],
      };
    case "sort":
      return {
        type: "sort",
        buckets: [
          { id: "a", label: "Bucket A" },
          { id: "b", label: "Bucket B" },
        ],
        items: [
          { id: "i1", label: "Item 1", bucketId: "a" },
          { id: "i2", label: "Item 2", bucketId: "b" },
        ],
      };
    default: {
      const neverType: never = type;
      throw new Error(`Unknown game type ${neverType}`);
    }
  }
}

export function memoryScore(pairs: number, mismatches: number): {
  score: number;
  maxScore: number;
} {
  const maxScore = Math.max(0, pairs) * 100;
  const score = Math.max(0, maxScore - mismatches * 10);
  return { score, maxScore };
}
