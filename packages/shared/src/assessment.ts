import { z } from "zod";
import { MAX_ATTEMPT_PAYLOAD_BYTES, serializedJsonBytes } from "./limits";
import {
  type BlankGame,
  type GameContent,
  type MemoryGame,
  type QuizGame,
  type SortGame,
  type TimelineGame,
  pieceCount,
  shuffledCopy,
} from "./games";
import { firstTryScore } from "./hearts";
import { learnerSchema } from "./path";

export const attemptModeSchema = z.enum(["assessment", "practice"]);
export type AttemptMode = z.infer<typeof attemptModeSchema>;

export const attemptStatusSchema = z.enum(["open", "finished"]);
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;

/** Quiz delivered to assessment play — no correctIndex / why. */
export const assessmentQuizSchema = z.object({
  type: z.literal("quiz"),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(1),
        choices: z.array(z.string().trim().min(1)).min(2).max(6),
      }),
    )
    .min(1),
});

/** Blank delivered with options only — no answer / why. */
export const assessmentBlankSchema = z.object({
  type: z.literal("blank"),
  items: z
    .array(
      z.object({
        sentence: z.string().trim().min(1),
        options: z.array(z.string().trim().min(1)).min(2).max(9),
      }),
    )
    .min(1)
    .max(12),
});

/** Timeline items without why; order is shuffled for delivery. */
export const assessmentTimelineSchema = z.object({
  type: z.literal("timeline"),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        year: z.string().trim().min(1).max(40).optional(),
      }),
    )
    .min(2)
    .max(12),
});

/** Sort chips without bucketId / why. */
export const assessmentSortSchema = z.object({
  type: z.literal("sort"),
  buckets: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
      }),
    )
    .min(2)
    .max(3),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
      }),
    )
    .min(2)
    .max(20),
});

/** Memory cards with opaque ids — pair map stays server-side. */
export const assessmentMemorySchema = z.object({
  type: z.literal("memory"),
  pairCount: z.number().int().min(2).max(8),
  cards: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        text: z.string().trim().optional(),
        imageUrl: z.string().trim().url().optional(),
      }),
    )
    .min(4)
    .max(16),
});

export const assessmentGameSchema = z.union([
  assessmentQuizSchema,
  assessmentBlankSchema,
  assessmentTimelineSchema,
  assessmentSortSchema,
  assessmentMemorySchema,
]);

export type AssessmentGame = z.infer<typeof assessmentGameSchema>;
export type AssessmentQuiz = z.infer<typeof assessmentQuizSchema>;
export type AssessmentBlank = z.infer<typeof assessmentBlankSchema>;
export type AssessmentTimeline = z.infer<typeof assessmentTimelineSchema>;
export type AssessmentSort = z.infer<typeof assessmentSortSchema>;
export type AssessmentMemory = z.infer<typeof assessmentMemorySchema>;

export const attemptInfoSchema = z.object({
  id: z.string().min(1),
  contentRevision: z.string().min(1),
  mode: attemptModeSchema,
  status: attemptStatusSchema,
});

export type AttemptInfo = z.infer<typeof attemptInfoSchema>;

export const attemptEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("quiz_choice"),
    questionIndex: z.number().int().nonnegative(),
    choiceIndex: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("blank_choice"),
    itemIndex: z.number().int().nonnegative(),
    word: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("memory_match"),
    cardA: z.string().trim().min(1),
    cardB: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("timeline_check"),
    order: z.array(z.string().trim().min(1)).min(2).max(12),
  }),
  z.object({
    type: z.literal("sort_check"),
    placements: z.record(z.string().trim().min(1)),
  }),
]);

export type AttemptEvent = z.infer<typeof attemptEventSchema>;

export const finishAnswersSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("quiz"),
    choices: z.array(z.number().int().nonnegative()).min(1),
  }),
  z.object({
    type: z.literal("blank"),
    words: z.array(z.string().trim().min(1)).min(1),
  }),
  z.object({
    type: z.literal("timeline"),
    order: z.array(z.string().trim().min(1)).min(2).max(12),
  }),
  z.object({
    type: z.literal("sort"),
    placements: z.record(z.string().trim().min(1)),
  }),
  z.object({
    type: z.literal("memory"),
    /** Successful match pairs as [cardA, cardB] lists recorded by the client; verified server-side. */
    matches: z
      .array(
        z.object({
          cardA: z.string().trim().min(1),
          cardB: z.string().trim().min(1),
        }),
      )
      .min(1),
  }),
]);

export type FinishAnswers = z.infer<typeof finishAnswersSchema>;

export const finishAttemptBodySchema = z
  .object({
    answers: finishAnswersSchema,
    /** Client-generated id so a retry after a failed save does not award XP twice. */
    clientAttemptId: z.string().trim().min(1).max(128).optional(),
  })
  .superRefine((body, ctx) => {
    const size = serializedJsonBytes(body);
    if (size == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Attempt payload must be JSON-serializable",
      });
      return;
    }
    if (size > MAX_ATTEMPT_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Attempt payload exceeds ${MAX_ATTEMPT_PAYLOAD_BYTES} bytes`,
      });
    }
  });

export const evaluateEventResultSchema = z.object({
  correct: z.boolean(),
  perfect: z.boolean().optional(),
  correctIds: z.array(z.string()).optional(),
  feedback: z
    .object({
      title: z.string().min(1),
      body: z.string().min(1),
    })
    .nullable()
    .optional(),
  misses: z.number().int().nonnegative(),
});

export type EvaluateEventResult = z.infer<typeof evaluateEventResultSchema>;

export const finishAttemptResultSchema = z.object({
  attemptId: z.string().min(1),
  mode: attemptModeSchema,
  completed: z.boolean(),
  firstTime: z.boolean(),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  learner: learnerSchema,
  /** True when this response reused a prior finish (idempotent retry). */
  deduplicated: z.boolean(),
  nextLevelId: z.string().min(1).nullable().optional(),
  continueHref: z.string().min(1).optional(),
});

export type FinishAttemptResult = z.infer<typeof finishAttemptResultSchema>;

export type MemoryPairMap = Record<string, number>;

export type AssessmentSecret = {
  memoryPairMap?: MemoryPairMap;
};

/** Stable JSON for revision hashing (sorted object keys). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const out: Record<string, unknown> = {};
    for (const [key, nested] of entries) out[key] = sortKeys(nested);
    return out;
  }
  return value;
}

export function sanitizeGameForAssessment(
  game: GameContent,
  secret?: AssessmentSecret,
): { play: AssessmentGame; secret: AssessmentSecret } {
  switch (game.type) {
    case "quiz":
      return {
        play: {
          type: "quiz",
          questions: game.questions.map((q) => ({
            prompt: q.prompt,
            choices: [...q.choices],
          })),
        },
        secret: secret ?? {},
      };
    case "blank":
      return {
        play: {
          type: "blank",
          items: game.items.map((item) => ({
            sentence: item.sentence,
            options: shuffledCopy([item.answer, ...item.decoys]),
          })),
        },
        secret: secret ?? {},
      };
    case "timeline": {
      const items = game.items.map(({ id, label, year }) => ({
        id,
        label,
        ...(year !== undefined ? { year } : {}),
      }));
      const shuffled = shuffledCopy(items);
      if (
        shuffled.length > 1 &&
        shuffled.every((item, i) => item.id === items[i]?.id)
      ) {
        [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
      }
      return { play: { type: "timeline", items: shuffled }, secret: secret ?? {} };
    }
    case "sort":
      return {
        play: {
          type: "sort",
          buckets: game.buckets.map((b) => ({ id: b.id, label: b.label })),
          items: game.items.map((item) => ({ id: item.id, label: item.label })),
        },
        secret: secret ?? {},
      };
    case "memory":
      // Prefer buildMemoryAssessment in the API so card ids are unguessable.
      return buildMemoryAssessment(game, () => {
        const n = Math.floor(Math.random() * 1e9).toString(36);
        return `card-${n}`;
      });
  }
}

/** Build memory assessment cards with unique ids (API layer). */
export function buildMemoryAssessment(
  game: MemoryGame,
  idFactory: () => string,
): { play: z.infer<typeof assessmentMemorySchema>; secret: AssessmentSecret } {
  const pairMap: MemoryPairMap = {};
  const cards: z.infer<typeof assessmentMemorySchema>["cards"] = [];
  game.pairs.forEach((pair, pairIndex) => {
    const idA = idFactory();
    const idB = idFactory();
    pairMap[idA] = pairIndex;
    pairMap[idB] = pairIndex;
    cards.push({
      id: idA,
      ...(pair.a.text ? { text: pair.a.text } : {}),
      ...(pair.a.imageUrl ? { imageUrl: pair.a.imageUrl } : {}),
    });
    cards.push({
      id: idB,
      ...(pair.b.text ? { text: pair.b.text } : {}),
      ...(pair.b.imageUrl ? { imageUrl: pair.b.imageUrl } : {}),
    });
  });
  return {
    play: {
      type: "memory",
      pairCount: game.pairs.length,
      cards: shuffledCopy(cards),
    },
    secret: { memoryPairMap: pairMap },
  };
}

export type GradedAttempt = {
  score: number;
  maxScore: number;
  stars: 1 | 2 | 3;
  misses: number;
};

export function gradeFromMisses(game: GameContent, misses: number): GradedAttempt {
  const scored = firstTryScore(pieceCount(game), misses);
  return {
    score: scored.score,
    maxScore: scored.maxScore,
    stars: scored.stars,
    misses: Math.max(0, misses),
  };
}

export function evaluateQuizChoice(
  game: QuizGame,
  questionIndex: number,
  choiceIndex: number,
): EvaluateEventResult {
  const question = game.questions[questionIndex];
  if (!question) {
    return { correct: false, feedback: null, misses: 1 };
  }
  const correct = choiceIndex === question.correctIndex;
  if (correct) return { correct: true, feedback: null, misses: 0 };
  const title = question.choices[question.correctIndex] ?? "Correct answer";
  return {
    correct: false,
    feedback: {
      title,
      body: question.why?.trim() || `The right answer is ${title}.`,
    },
    misses: 1,
  };
}

export function evaluateBlankChoice(
  game: BlankGame,
  itemIndex: number,
  word: string,
): EvaluateEventResult {
  const item = game.items[itemIndex];
  if (!item) return { correct: false, feedback: null, misses: 1 };
  const correct =
    word.trim().toLowerCase() === item.answer.trim().toLowerCase();
  if (correct) return { correct: true, feedback: null, misses: 0 };
  return {
    correct: false,
    feedback: {
      title: item.answer,
      body: item.why?.trim() || `The missing word is ${item.answer}.`,
    },
    misses: 1,
  };
}

export function evaluateMemoryMatch(
  pairMap: MemoryPairMap,
  cardA: string,
  cardB: string,
  whyForPair: (pairIndex: number) => string | undefined,
): EvaluateEventResult {
  if (cardA === cardB) {
    return { correct: false, feedback: null, misses: 1 };
  }
  const a = pairMap[cardA];
  const b = pairMap[cardB];
  if (a === undefined || b === undefined || a !== b) {
    return { correct: false, feedback: null, misses: 1 };
  }
  const why = whyForPair(a)?.trim();
  return {
    correct: true,
    feedback: why ? { title: "Matched", body: why } : null,
    misses: 0,
  };
}

export function evaluateTimelineCheck(
  game: TimelineGame,
  order: string[],
): EvaluateEventResult {
  const expected = game.items.map((item) => item.id);
  if (order.length !== expected.length) {
    return { correct: false, perfect: false, correctIds: [], misses: 1 };
  }
  const correctIds: string[] = [];
  const wrong: TimelineGame["items"] = [];
  expected.forEach((id, index) => {
    if (order[index] === id) correctIds.push(id);
    else {
      const item = game.items.find((entry) => entry.id === order[index]);
      if (item) wrong.push(item);
    }
  });
  const perfect = wrong.length === 0;
  return {
    correct: perfect,
    perfect,
    correctIds,
    feedback: perfect ? null : formatMultiWhy(wrong),
    misses: perfect ? 0 : 1,
  };
}

export function evaluateSortCheck(
  game: SortGame,
  placements: Record<string, string>,
): EvaluateEventResult {
  const correctIds: string[] = [];
  const wrong: SortGame["items"] = [];
  for (const item of game.items) {
    if (placements[item.id] === item.bucketId) correctIds.push(item.id);
    else wrong.push(item);
  }
  const perfect = wrong.length === 0;
  return {
    correct: perfect,
    perfect,
    correctIds,
    feedback: perfect ? null : formatMultiWhy(wrong),
    misses: perfect ? 0 : 1,
  };
}

function formatMultiWhy(
  items: { label: string; why?: string }[],
): { title: string; body: string } | null {
  const withWhy = items.filter((item) => item.why?.trim());
  if (withWhy.length === 0) return null;
  if (withWhy.length === 1) {
    const item = withWhy[0]!;
    return { title: item.label, body: item.why!.trim() };
  }
  return {
    title: "Check these again",
    body: withWhy.map((item) => `${item.label} — ${item.why!.trim()}`).join("\n\n"),
  };
}

/** Sum miss increments recorded on attempt events (server-authoritative). */
export function missesFromEventResults(
  results: { misses: number }[],
): number {
  return results.reduce((sum, row) => sum + Math.max(0, row.misses), 0);
}

/**
 * Grade a finished assessment from answers (+ optional prior check/match misses).
 * Placement games must be perfect on finish; earlier failed checks add to misses.
 */
export function gradeAssessmentFinish(
  game: GameContent,
  answers: FinishAnswers,
  priorMisses: number,
  secret?: AssessmentSecret,
): GradedAttempt {
  switch (answers.type) {
    case "quiz": {
      if (game.type !== "quiz") throw new Error("Answer type mismatch");
      if (answers.choices.length !== game.questions.length) {
        throw new Error("Quiz answers incomplete");
      }
      let misses = 0;
      answers.choices.forEach((choice, index) => {
        if (choice !== game.questions[index]!.correctIndex) misses += 1;
      });
      return gradeFromMisses(game, misses);
    }
    case "blank": {
      if (game.type !== "blank") throw new Error("Answer type mismatch");
      if (answers.words.length !== game.items.length) {
        throw new Error("Blank answers incomplete");
      }
      let misses = 0;
      answers.words.forEach((word, index) => {
        const expected = game.items[index]!.answer.trim().toLowerCase();
        if (word.trim().toLowerCase() !== expected) misses += 1;
      });
      return gradeFromMisses(game, misses);
    }
    case "timeline": {
      if (game.type !== "timeline") throw new Error("Answer type mismatch");
      const check = evaluateTimelineCheck(game, answers.order);
      if (!check.perfect) throw new Error("Timeline is not complete");
      return gradeFromMisses(game, priorMisses);
    }
    case "sort": {
      if (game.type !== "sort") throw new Error("Answer type mismatch");
      const check = evaluateSortCheck(game, answers.placements);
      if (!check.perfect) throw new Error("Sort is not complete");
      return gradeFromMisses(game, priorMisses);
    }
    case "memory": {
      if (game.type !== "memory") throw new Error("Answer type mismatch");
      const pairMap = secret?.memoryPairMap;
      if (!pairMap) throw new Error("Memory pair map missing");
      const matchedPairs = new Set<number>();
      for (const match of answers.matches) {
        const result = evaluateMemoryMatch(
          pairMap,
          match.cardA,
          match.cardB,
          () => undefined,
        );
        if (!result.correct) throw new Error("Invalid memory match");
        const pairIndex = pairMap[match.cardA]!;
        matchedPairs.add(pairIndex);
      }
      if (matchedPairs.size !== game.pairs.length) {
        throw new Error("Memory matches incomplete");
      }
      return gradeFromMisses(game, priorMisses);
    }
  }
}
