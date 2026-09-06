import { z } from "zod";
import { MAX_LESSON_MARKDOWN_CHARS } from "./limits";
import { lessonBlocksSchema } from "./lesson-blocks";
import {
  emptyLessonEditorial,
  lessonEditorialSchema,
} from "./editorial";
import {
  caseFilesGameSchema,
  dapitanGameSchema,
  dispatchesGameSchema,
  editorialGameSchema,
  emptyCaseFilesGame,
  emptyDapitanGame,
  emptyDispatchesGame,
  emptyEditorialGame,
} from "./advanced-games";

const nonEmpty = z.string().trim().min(1);
const optionalWhy = z.string().trim().max(400).optional();
const optionalText = z.string().trim().max(400).optional();

export const sourceRefSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  excerpt: z.string().trim().max(600).optional(),
  citation: z.string().trim().max(280).optional(),
});

export type SourceRef = z.infer<typeof sourceRefSchema>;

export const quizChoiceSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
});

export const quizRationaleSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
  correct: z.boolean().optional(),
});

export const quizQuestionSchema = z
  .object({
    id: nonEmpty,
    kind: z.enum(["recall", "evidence"]).default("recall"),
    prompt: nonEmpty,
    claim: optionalText,
    sources: z.array(sourceRefSchema).max(6).optional(),
    choices: z.array(quizChoiceSchema).min(2).max(6),
    correctChoiceId: nonEmpty,
    rationales: z.array(quizRationaleSchema).max(6).optional(),
    correctRationaleId: nonEmpty.optional(),
    objectiveTags: z.array(nonEmpty).max(8).optional(),
    why: optionalWhy,
    whyCorrect: optionalWhy,
    assessment: z.enum(["auto", "teacher-review"]).default("auto"),
  })
  .superRefine((question, ctx) => {
    if (!question.choices.some((choice) => choice.id === question.correctChoiceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctChoiceId must match a choice id",
        path: ["correctChoiceId"],
      });
    }
    const choiceIds = question.choices.map((choice) => choice.id);
    if (new Set(choiceIds).size !== choiceIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choice ids must be unique",
        path: ["choices"],
      });
    }
    if (question.kind === "evidence" && (!question.sources || question.sources.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evidence questions need at least two sources",
        path: ["sources"],
      });
    }
    if (question.correctRationaleId) {
      const rationales = question.rationales ?? [];
      if (!rationales.some((item) => item.id === question.correctRationaleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "correctRationaleId must match a rationale id",
          path: ["correctRationaleId"],
        });
      }
    }
  });

export const quizGameSchema = z.object({
  type: z.literal("quiz"),
  title: optionalText,
  questions: z.array(quizQuestionSchema).min(1),
});

export const memorySideSchema = z
  .object({
    text: z.string().trim().optional(),
    imageUrl: z.string().trim().url().optional(),
    alt: z.string().trim().max(160).optional(),
  })
  .refine((side) => Boolean(side.text) || Boolean(side.imageUrl), {
    message: "Each card side needs text or an image URL",
  })
  .refine((side) => !side.imageUrl || Boolean(side.alt?.trim() || side.text?.trim()), {
    message: "Image cards need alt text or a caption",
  });

export const memoryPairSchema = z.object({
  id: nonEmpty,
  a: memorySideSchema,
  b: memorySideSchema,
  why: optionalWhy,
  explanation: optionalWhy,
  artifactLabel: optionalText,
  relation: z
    .enum(["person-contribution", "work-theme", "place-event", "other"])
    .optional(),
});

export const memoryTimingSchema = z.object({
  secondsPerPair: z.number().positive().max(60).default(8),
  mismatchPenaltyMs: z.number().int().nonnegative().max(30_000).default(3_000),
});

export const memoryGameSchema = z.object({
  type: z.literal("memory"),
  title: optionalText,
  playMode: z.enum(["learning", "timed"]).default("learning"),
  timing: memoryTimingSchema.optional(),
  pairs: z.array(memoryPairSchema).min(2).max(8),
});

export const timelineItemSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  year: z.string().trim().min(1).max(40).optional(),
  why: optionalWhy,
  groupId: nonEmpty.optional(),
});

export const causalChoiceSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
});

export const causalLinkSchema = z
  .object({
    prompt: nonEmpty,
    choices: z.array(causalChoiceSchema).min(2).max(6),
    correctChoiceId: nonEmpty,
    explanation: nonEmpty,
    fromItemId: nonEmpty.optional(),
    toItemId: nonEmpty.optional(),
  })
  .refine(
    (link) => link.choices.some((choice) => choice.id === link.correctChoiceId),
    { message: "correctChoiceId must match a causal choice", path: ["correctChoiceId"] },
  );

export const timelineGameSchema = z.object({
  type: z.literal("timeline"),
  title: optionalText,
  dateHints: z.enum(["always", "optional", "hidden"]).default("always"),
  items: z.array(timelineItemSchema).min(2).max(12),
  causalLink: causalLinkSchema.optional(),
});

export const blankDistractorSchema = z.object({
  text: nonEmpty,
  why: optionalWhy,
});

export const blankItemSchema = z.object({
  id: nonEmpty.optional(),
  sentence: nonEmpty,
  answer: nonEmpty,
  decoys: z.array(nonEmpty).min(1).max(8),
  why: optionalWhy,
  whyCorrect: optionalWhy,
  objective: optionalText,
  source: sourceRefSchema.omit({ id: true }).extend({ id: nonEmpty.optional() }).optional(),
  distractors: z.array(blankDistractorSchema).max(8).optional(),
});

export const blankGameSchema = z.object({
  type: z.literal("blank"),
  title: optionalText,
  items: z.array(blankItemSchema).min(1).max(12),
});

export const sortBucketSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  role: z.enum(["category", "insufficient-evidence"]).default("category"),
});

export const sortJustificationSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
  correct: z.boolean().optional(),
});

export const sortItemSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  bucketId: nonEmpty.optional(),
  why: optionalWhy,
  source: sourceRefSchema.omit({ id: true }).extend({ id: nonEmpty.optional() }).optional(),
  justificationChoices: z.array(sortJustificationSchema).max(6).optional(),
  correctJustificationId: nonEmpty.optional(),
  scoring: z.enum(["auto", "discussion"]).default("auto"),
});

export const sortGameSchema = z
  .object({
    type: z.literal("sort"),
    title: optionalText,
    buckets: z.array(sortBucketSchema).min(2).max(4),
    items: z.array(sortItemSchema).min(2).max(20),
  })
  .superRefine((game, ctx) => {
    const bucketIds = new Set(game.buckets.map((bucket) => bucket.id));
    if (bucketIds.size !== game.buckets.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bucket ids must be unique",
        path: ["buckets"],
      });
    }
    game.items.forEach((item, index) => {
      if (item.correctJustificationId) {
        const choices = item.justificationChoices ?? [];
        if (!choices.some((choice) => choice.id === item.correctJustificationId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "correctJustificationId must match a justification choice",
            path: ["items", index, "correctJustificationId"],
          });
        }
      }
    });
  });

export const gameContentSchema = z.union([
  quizGameSchema,
  memoryGameSchema,
  timelineGameSchema,
  blankGameSchema,
  sortGameSchema,
  caseFilesGameSchema,
  dispatchesGameSchema,
  editorialGameSchema,
  dapitanGameSchema,
]);

export type QuizChoice = z.infer<typeof quizChoiceSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizGame = z.infer<typeof quizGameSchema>;
export type MemoryGame = z.infer<typeof memoryGameSchema>;
export type MemoryPair = z.infer<typeof memoryPairSchema>;
export type TimelineGame = z.infer<typeof timelineGameSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type CausalLink = z.infer<typeof causalLinkSchema>;
export type BlankGame = z.infer<typeof blankGameSchema>;
export type BlankItem = z.infer<typeof blankItemSchema>;
export type SortGame = z.infer<typeof sortGameSchema>;
export type SortItem = z.infer<typeof sortItemSchema>;
export type SortBucket = z.infer<typeof sortBucketSchema>;
export type GameContent = z.infer<typeof gameContentSchema>;

export function countBlanks(sentence: string): number {
  return (sentence.match(/___/g) ?? []).length;
}

/** Normalize cloze keys so accents/punctuation alone cannot create duplicate answers. */
export function normalizeBlankKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function pairExplanation(pair: {
  why?: string;
  explanation?: string;
}): string | undefined {
  const text = pair.explanation?.trim() || pair.why?.trim();
  return text || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function coerceQuizQuestion(raw: unknown, index: number): unknown {
  const question = asRecord(raw);
  if (!question) return raw;
  const legacyChoices = question.choices;
  let choices: Array<{ id: string; text: string }>;
  if (
    Array.isArray(legacyChoices) &&
    legacyChoices.every((choice) => typeof choice === "string")
  ) {
    choices = legacyChoices.map((text, choiceIndex) => ({
      id: `q${index + 1}-c${choiceIndex + 1}`,
      text,
    }));
  } else if (Array.isArray(legacyChoices)) {
    choices = legacyChoices.map((choice, choiceIndex) => {
      const entry = asRecord(choice);
      if (entry && typeof entry.id === "string" && typeof entry.text === "string") {
        return { id: entry.id, text: entry.text };
      }
      return {
        id: `q${index + 1}-c${choiceIndex + 1}`,
        text: String(choice),
      };
    });
  } else {
    choices = [];
  }

  const correctIndex =
    typeof question.correctIndex === "number" ? question.correctIndex : undefined;
  const correctChoiceId =
    typeof question.correctChoiceId === "string"
      ? question.correctChoiceId
      : correctIndex !== undefined
        ? choices[correctIndex]?.id
        : undefined;

  return {
    kind: "recall",
    assessment: "auto",
    ...question,
    id: typeof question.id === "string" ? question.id : `q${index + 1}`,
    choices,
    correctChoiceId,
  };
}

function coerceMemorySide(raw: unknown): unknown {
  const side = asRecord(raw);
  if (!side) return raw;
  if (typeof side.imageUrl === "string" && !side.alt && !side.text) {
    return { ...side, alt: "Historical image" };
  }
  return side;
}

function coerceMemoryPair(raw: unknown, index: number): unknown {
  const pair = asRecord(raw);
  if (!pair) return raw;
  return {
    ...pair,
    id: typeof pair.id === "string" ? pair.id : `pair-${index + 1}`,
    a: coerceMemorySide(pair.a),
    b: coerceMemorySide(pair.b),
  };
}

function coerceBlankItem(raw: unknown, index: number): unknown {
  const item = asRecord(raw);
  if (!item) return raw;
  return {
    ...item,
    id: typeof item.id === "string" ? item.id : `blank-${index + 1}`,
  };
}

function coerceSortBucket(raw: unknown): unknown {
  const bucket = asRecord(raw);
  if (!bucket) return raw;
  return {
    role: "category",
    ...bucket,
  };
}

function coerceSortItem(raw: unknown): unknown {
  const item = asRecord(raw);
  if (!item) return raw;
  return {
    scoring: "auto",
    ...item,
  };
}

export function coerceGameContent(raw: unknown): unknown {
  const game = asRecord(raw);
  if (!game || typeof game.type !== "string") return raw;

  if (game.type === "timeline" && Array.isArray(game.items)) {
    if (game.items.every((item) => typeof item === "string")) {
      return {
        dateHints: "always",
        ...game,
        items: game.items.map((label, index) => ({
          id: `event-${index + 1}`,
          label,
        })),
      };
    }
    return {
      dateHints: "always",
      ...game,
    };
  }

  if (game.type === "quiz" && Array.isArray(game.questions)) {
    return {
      ...game,
      questions: game.questions.map((question, index) =>
        coerceQuizQuestion(question, index),
      ),
    };
  }

  if (game.type === "memory" && Array.isArray(game.pairs)) {
    return {
      playMode: "learning",
      ...game,
      pairs: game.pairs.map((pair, index) => coerceMemoryPair(pair, index)),
    };
  }

  if (game.type === "blank" && Array.isArray(game.items)) {
    return {
      ...game,
      items: game.items.map((item, index) => coerceBlankItem(item, index)),
    };
  }

  if (game.type === "sort") {
    return {
      ...game,
      buckets: Array.isArray(game.buckets)
        ? game.buckets.map(coerceSortBucket)
        : game.buckets,
      items: Array.isArray(game.items) ? game.items.map(coerceSortItem) : game.items,
    };
  }

  return raw;
}

export function parseGameContent(raw: unknown): GameContent {
  return gameContentSchema.parse(coerceGameContent(raw));
}

export function emptyGameContent(type: GameContent["type"]): GameContent {
  switch (type) {
    case "quiz":
      return {
        type: "quiz",
        questions: [
          {
            id: "q1",
            kind: "recall",
            prompt: "Question",
            choices: [
              { id: "q1-c1", text: "Choice A" },
              { id: "q1-c2", text: "Choice B" },
            ],
            correctChoiceId: "q1-c1",
            why: "Mark the right choice, then add a short why.",
            whyCorrect: "Confirm the reasoning so correct answers also teach.",
            assessment: "auto",
            objectiveTags: ["recall"],
          },
        ],
      };
    case "memory":
      return {
        type: "memory",
        playMode: "learning",
        pairs: [
          {
            id: "pair-1",
            a: { text: "Card A1" },
            b: { text: "Card B1" },
            explanation: "These two go together.",
            artifactLabel: "Matched card",
            relation: "other",
          },
          {
            id: "pair-2",
            a: { text: "Card A2" },
            b: { text: "Card B2" },
            explanation: "Add a short archive note for this pair.",
          },
        ],
      };
    case "timeline":
      return {
        type: "timeline",
        dateHints: "optional",
        items: [
          { id: "event-1", label: "First", year: "1" },
          { id: "event-2", label: "Second", year: "2" },
        ],
        causalLink: {
          prompt: "How are these stops connected?",
          choices: [
            { id: "cause-1", text: "The first made the second possible" },
            { id: "cause-2", text: "They are unrelated" },
          ],
          correctChoiceId: "cause-1",
          explanation: "Order the events, then explain the connection.",
          fromItemId: "event-1",
          toItemId: "event-2",
        },
      };
    case "blank":
      return {
        type: "blank",
        items: [
          {
            id: "blank-1",
            sentence: "Rizal was born in ___.",
            answer: "Calamba",
            decoys: ["Manila", "Dapitan"],
            why: "He was born in Calamba, Laguna, in 1861.",
            whyCorrect: "Calamba anchors his early life on the path.",
            objective: "Locate Rizal’s birthplace from a sourced passage.",
            source: {
              id: "src-birth",
              label: "Childhood overview",
              citation: "Module lesson: Childhood",
            },
            distractors: [
              { text: "Manila", why: "Manila is later schooling, not his birthplace." },
              { text: "Dapitan", why: "Dapitan is exile, decades later." },
            ],
          },
        ],
      };
    case "sort":
      return {
        type: "sort",
        buckets: [
          { id: "a", label: "Bucket A", role: "category" },
          { id: "b", label: "Bucket B", role: "category" },
        ],
        items: [
          {
            id: "i1",
            label: "Item 1",
            bucketId: "a",
            scoring: "auto",
            why: "Explain why this belongs here.",
          },
          {
            id: "i2",
            label: "Item 2",
            bucketId: "b",
            scoring: "auto",
          },
        ],
      };
    case "case-files":
      return emptyCaseFilesGame();
    case "dispatches":
      return emptyDispatchesGame();
    case "editorial":
      return emptyEditorialGame();
    case "dapitan":
      return emptyDapitanGame();
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

/** Deterministic shuffle for tests: rotates left by one when length > 1. */
export function rotateShuffle<T>(items: T[]): T[] {
  if (items.length < 2) return [...items];
  return [...items.slice(1), items[0]!];
}

export function pieceCount(game: GameContent): number {
  switch (game.type) {
    case "quiz":
      return game.questions.length;
    case "memory":
      return game.pairs.length;
    case "timeline":
      return game.items.length + (game.causalLink ? 1 : 0);
    case "blank":
      return game.items.length;
    case "sort":
      return game.items.filter((item) => item.scoring !== "discussion").length ||
        game.items.length;
    case "case-files":
      return game.rubric.length;
    case "dispatches":
      return game.stops.length;
    case "editorial":
      return game.slots.length;
    case "dapitan":
      return game.turns;
  }
}

export function quizChoiceById(question: QuizQuestion, choiceId: string) {
  return question.choices.find((choice) => choice.id === choiceId);
}

export function scoreQuizRationale(
  question: QuizQuestion,
  rationaleId: string | null | undefined,
): { scored: boolean; correct: boolean } {
  if (question.assessment === "teacher-review") {
    return { scored: false, correct: false };
  }
  if (!question.correctRationaleId) {
    return { scored: false, correct: false };
  }
  return {
    scored: true,
    correct: rationaleId === question.correctRationaleId,
  };
}

export const lessonContentSchema = z.object({
  markdown: z.string().max(MAX_LESSON_MARKDOWN_CHARS),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
  blocks: lessonBlocksSchema.optional(),
  editorial: lessonEditorialSchema.default(emptyLessonEditorial()),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;
