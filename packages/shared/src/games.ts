import { z } from "zod";
import { lessonBlocksSchema } from "./lesson-blocks";

const nonEmpty = z.string().trim().min(1);
const optionalWhy = z.string().trim().max(280).optional();

export const quizQuestionSchema = z
  .object({
    prompt: nonEmpty,
    choices: z.array(nonEmpty).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
    why: optionalWhy,
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

export const memoryPairSchema = z.object({
  a: memorySideSchema,
  b: memorySideSchema,
  why: optionalWhy,
});

export const memoryGameSchema = z.object({
  type: z.literal("memory"),
  pairs: z.array(memoryPairSchema).min(2).max(8),
});

export const timelineItemSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  year: z.string().trim().min(1).max(40).optional(),
  why: optionalWhy,
});

export const timelineGameSchema = z.object({
  type: z.literal("timeline"),
  items: z.array(timelineItemSchema).min(2).max(12),
});

export const blankItemSchema = z.object({
  sentence: nonEmpty,
  answer: nonEmpty,
  decoys: z.array(nonEmpty).min(1).max(8),
  why: optionalWhy,
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
  why: optionalWhy,
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
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type BlankGame = z.infer<typeof blankGameSchema>;
export type SortGame = z.infer<typeof sortGameSchema>;
export type GameContent = z.infer<typeof gameContentSchema>;

export const lessonContentSchema = z.object({
  markdown: z.string(),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
  blocks: lessonBlocksSchema.optional(),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;

export function coerceGameContent(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const game = raw as { type?: unknown; items?: unknown };
  if (game.type !== "timeline" || !Array.isArray(game.items)) return raw;
  if (game.items.every((item) => typeof item === "string")) {
    return {
      ...game,
      items: game.items.map((label, index) => ({
        id: `event-${index + 1}`,
        label,
      })),
    };
  }
  return raw;
}

export function parseGameContent(raw: unknown): GameContent {
  return gameContentSchema.parse(coerceGameContent(raw));
}

export function emptyGameContent(
  type: GameContent["type"],
): z.input<typeof gameContentSchema> {
  switch (type) {
    case "quiz":
      return {
        type: "quiz",
        questions: [
          {
            prompt: "Question",
            choices: ["Choice A", "Choice B"],
            correctIndex: 0,
            why: "Mark the right choice, then add a short why.",
          },
        ],
      };
    case "memory":
      return {
        type: "memory",
        pairs: [
          { a: { text: "Card A1" }, b: { text: "Card B1" }, why: "These two go together." },
          { a: { text: "Card A2" }, b: { text: "Card B2" } },
        ],
      };
    case "timeline":
      return {
        type: "timeline",
        items: [
          { id: "event-1", label: "First", year: "1" },
          { id: "event-2", label: "Second", year: "2" },
        ],
      };
    case "blank":
      return {
        type: "blank",
        items: [
          {
            sentence: "Rizal was born in ___.",
            answer: "Calamba",
            decoys: ["Manila", "Dapitan"],
            why: "He was born in Calamba, Laguna, in 1861.",
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

export function shuffledCopy<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export function pieceCount(game: GameContent): number {
  switch (game.type) {
    case "quiz":
      return game.questions.length;
    case "memory":
      return game.pairs.length;
    case "timeline":
      return game.items.length;
    case "blank":
      return game.items.length;
    case "sort":
      return game.items.length;
  }
}
