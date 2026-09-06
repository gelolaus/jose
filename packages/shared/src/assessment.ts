import { z } from "zod";
import { MAX_ATTEMPT_PAYLOAD_BYTES, serializedJsonBytes } from "./limits";
import {
  type BlankGame,
  type GameContent,
  type MemoryGame,
  type QuizGame,
  type QuizQuestion,
  type SortGame,
  type TimelineGame,
  pairExplanation,
  pieceCount,
  shuffledCopy,
  normalizeBlankKey,
} from "./games";
import { firstTryScore } from "./hearts";
import {
  caseFilesGameSchema,
  dapitanGameSchema,
  dispatchesGameSchema,
  editorialGameSchema,
} from "./advanced-games";
import { learnerSchema } from "./path";

export const attemptModeSchema = z.enum(["assessment", "practice"]);
export type AttemptMode = z.infer<typeof attemptModeSchema>;

export const attemptStatusSchema = z.enum(["open", "finished"]);
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;

/** Quiz delivered to assessment play — no correctChoiceId / why. */
export const assessmentQuizSchema = z.object({
  type: z.literal("quiz"),
  title: z.string().trim().optional(),
  questions: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        kind: z.enum(["recall", "evidence"]).optional(),
        prompt: z.string().trim().min(1),
        claim: z.string().trim().optional(),
        sources: z
          .array(
            z.object({
              id: z.string().trim().min(1),
              label: z.string().trim().min(1),
              excerpt: z.string().trim().optional(),
              citation: z.string().trim().optional(),
            }),
          )
          .optional(),
        choices: z
          .array(
            z.object({
              id: z.string().trim().min(1),
              text: z.string().trim().min(1),
            }),
          )
          .min(2)
          .max(6),
        rationales: z
          .array(
            z.object({
              id: z.string().trim().min(1),
              text: z.string().trim().min(1),
            }),
          )
          .optional(),
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
  dateHints: z.enum(["always", "optional", "hidden"]).optional(),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        year: z.string().trim().min(1).max(40).optional(),
        groupId: z.string().trim().min(1).optional(),
      }),
    )
    .min(2)
    .max(12),
  causalLink: z
    .object({
      prompt: z.string().trim().min(1),
      choices: z
        .array(
          z.object({
            id: z.string().trim().min(1),
            text: z.string().trim().min(1),
          }),
        )
        .min(2),
    })
    .optional(),
});

/** Sort chips without bucketId / why. */
export const assessmentSortSchema = z.object({
  type: z.literal("sort"),
  buckets: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        role: z.enum(["category", "insufficient-evidence"]).optional(),
      }),
    )
    .min(2)
    .max(4),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        scoring: z.enum(["auto", "discussion"]).optional(),
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
        alt: z.string().trim().optional(),
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
  caseFilesGameSchema,
  dispatchesGameSchema,
  editorialGameSchema,
  dapitanGameSchema,
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
    choiceIndex: z.number().int().nonnegative().optional(),
    choiceId: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal("quiz_rationale"),
    questionIndex: z.number().int().nonnegative(),
    rationaleId: z.string().trim().min(1),
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
    type: z.literal("timeline_causal"),
    choiceId: z.string().trim().min(1),
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
    choices: z.array(z.union([z.number().int().nonnegative(), z.string().trim().min(1)])).min(1),
    rationales: z.array(z.string().trim().min(1).nullable()).optional(),
  }),
  z.object({
    type: z.literal("blank"),
    words: z.array(z.string().trim().min(1)).min(1),
  }),
  z.object({
    type: z.literal("timeline"),
    order: z.array(z.string().trim().min(1)).min(2).max(12),
    causalChoiceId: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal("sort"),
    placements: z.record(z.string().trim().min(1)),
  }),
  z.object({
    type: z.literal("memory"),
    matches: z
      .array(
        z.object({
          cardA: z.string().trim().min(1),
          cardB: z.string().trim().min(1),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("case-files"),
    completed: z.literal(true),
  }),
  z.object({
    type: z.literal("dispatches"),
    completed: z.literal(true),
  }),
  z.object({
    type: z.literal("editorial"),
    completed: z.literal(true),
  }),
  z.object({
    type: z.literal("dapitan"),
    completed: z.literal(true),
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
          ...(game.title ? { title: game.title } : {}),
          questions: game.questions.map((q) => ({
            id: q.id,
            ...(q.kind ? { kind: q.kind } : {}),
            prompt: q.prompt,
            ...(q.claim ? { claim: q.claim } : {}),
            ...(q.sources?.length ? { sources: q.sources } : {}),
            choices: q.choices.map((choice) => ({ id: choice.id, text: choice.text })),
            ...(q.rationales?.length
              ? {
                  rationales: q.rationales.map((item) => ({
                    id: item.id,
                    text: item.text,
                  })),
                }
              : {}),
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
      const items = game.items.map(({ id, label, year, groupId }) => ({
        id,
        label,
        ...(year !== undefined && game.dateHints !== "hidden" ? { year } : {}),
        ...(groupId ? { groupId } : {}),
      }));
      return {
        play: {
          type: "timeline",
          ...(game.dateHints ? { dateHints: game.dateHints } : {}),
          items,
          ...(game.causalLink
            ? {
                causalLink: {
                  prompt: game.causalLink.prompt,
                  choices: game.causalLink.choices.map((choice) => ({
                    id: choice.id,
                    text: choice.text,
                  })),
                },
              }
            : {}),
        },
        secret: secret ?? {},
      };
    }
    case "sort":
      return {
        play: {
          type: "sort",
          buckets: game.buckets.map((b) => ({
            id: b.id,
            label: b.label,
            ...(b.role ? { role: b.role } : {}),
          })),
          items: game.items.map((item) => ({
            id: item.id,
            label: item.label,
            ...(item.scoring === "discussion" ? { scoring: "discussion" as const } : {}),
          })),
        },
        secret: secret ?? {},
      };
    case "memory":
      return buildMemoryAssessment(game, () => {
        const n = Math.floor(Math.random() * 1e9).toString(36);
        return `card-${n}`;
      });
    case "case-files":
    case "dispatches":
    case "editorial":
    case "dapitan":
      return { play: game, secret: secret ?? {} };
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
      ...(pair.a.alt ? { alt: pair.a.alt } : {}),
    });
    cards.push({
      id: idB,
      ...(pair.b.text ? { text: pair.b.text } : {}),
      ...(pair.b.imageUrl ? { imageUrl: pair.b.imageUrl } : {}),
      ...(pair.b.alt ? { alt: pair.b.alt } : {}),
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

export function resolveQuizChoiceId(
  question: QuizQuestion,
  choiceId?: string,
  choiceIndex?: number,
): string | undefined {
  if (choiceId) return choiceId;
  if (choiceIndex === undefined) return undefined;
  return question.choices[choiceIndex]?.id;
}

export function evaluateQuizChoice(
  game: QuizGame,
  questionIndex: number,
  choiceIdOrIndex?: string | number,
  choiceIndex?: number,
): EvaluateEventResult {
  const question = game.questions[questionIndex];
  if (!question) {
    return { correct: false, feedback: null, misses: 1 };
  }
  const pickedId =
    typeof choiceIdOrIndex === "number"
      ? resolveQuizChoiceId(question, undefined, choiceIdOrIndex)
      : resolveQuizChoiceId(question, choiceIdOrIndex, choiceIndex);
  const correct = pickedId === question.correctChoiceId;
  const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);
  if (correct) {
    return {
      correct: true,
      feedback: question.whyCorrect?.trim()
        ? { title: "Why this is right", body: question.whyCorrect.trim() }
        : null,
      misses: 0,
    };
  }
  const title = correctChoice?.text ?? "Correct answer";
  return {
    correct: false,
    feedback: {
      title,
      body: question.why?.trim() || `The right answer is ${title}.`,
    },
    misses: 1,
  };
}

export function evaluateQuizRationale(
  game: QuizGame,
  questionIndex: number,
  rationaleId: string,
): EvaluateEventResult {
  const question = game.questions[questionIndex];
  if (!question?.correctRationaleId) {
    return { correct: true, feedback: null, misses: 0 };
  }
  const correct = rationaleId === question.correctRationaleId;
  if (correct) return { correct: true, feedback: null, misses: 0 };
  const right = question.rationales?.find((item) => item.id === question.correctRationaleId);
  return {
    correct: false,
    feedback: {
      title: right?.text ?? "Stronger reason",
      body: question.why?.trim() || "Pick the reason that ties the evidence to the claim.",
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
    normalizeBlankKey(word) === normalizeBlankKey(item.answer);
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

function timelineOrderKey(item: TimelineGame["items"][number]): string {
  return item.groupId?.trim() || `__solo_${item.id}`;
}

export function evaluateTimelineCheck(
  game: TimelineGame,
  order: string[],
): EvaluateEventResult {
  if (order.length !== game.items.length) {
    return { correct: false, perfect: false, correctIds: [], misses: 1 };
  }
  const correctIds: string[] = [];
  const wrong: TimelineGame["items"] = [];
  game.items.forEach((slotItem, index) => {
    const placedId = order[index];
    const occupant = game.items.find((entry) => entry.id === placedId);
    if (!occupant) return;
    if (timelineOrderKey(slotItem) === timelineOrderKey(occupant)) {
      correctIds.push(occupant.id);
      return;
    }
    wrong.push(occupant);
  });
  const uniqueCorrect = [...new Set(correctIds)];
  const perfect = wrong.length === 0 && uniqueCorrect.length === game.items.length;
  return {
    correct: perfect,
    perfect,
    correctIds: uniqueCorrect,
    feedback: perfect ? null : formatMultiWhy(wrong),
    misses: perfect ? 0 : 1,
  };
}

export function evaluateTimelineCausal(
  game: TimelineGame,
  choiceId: string,
): EvaluateEventResult {
  const link = game.causalLink;
  if (!link) return { correct: true, perfect: true, misses: 0 };
  const correct = choiceId === link.correctChoiceId;
  return {
    correct,
    perfect: correct,
    feedback: correct
      ? link.explanation
        ? { title: "Connection", body: link.explanation }
        : null
      : {
          title: "Check the connection",
          body: link.explanation || "That is not the authored causal link.",
        },
    misses: correct ? 0 : 1,
  };
}

export function evaluateSortCheck(
  game: SortGame,
  placements: Record<string, string>,
): EvaluateEventResult {
  const correctIds: string[] = [];
  const wrong: SortGame["items"] = [];
  const discussionIds: string[] = [];
  for (const item of game.items) {
    if (item.scoring === "discussion") {
      if (placements[item.id]) discussionIds.push(item.id);
      continue;
    }
    if (placements[item.id] === item.bucketId) correctIds.push(item.id);
    else wrong.push(item);
  }
  const autoItems = game.items.filter((item) => item.scoring !== "discussion");
  const perfect = wrong.length === 0 && correctIds.length === autoItems.length;
  return {
    correct: perfect,
    perfect,
    correctIds: [...correctIds, ...discussionIds],
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
        const question = game.questions[index]!;
        const choiceId =
          typeof choice === "number" ? question.choices[choice]?.id : choice;
        if (choiceId !== question.correctChoiceId) misses += 1;
      });
      if (answers.rationales?.length) {
        answers.rationales.forEach((rationaleId, index) => {
          const question = game.questions[index]!;
          if (!question.correctRationaleId) return;
          if (rationaleId !== question.correctRationaleId) misses += 1;
        });
      }
      return gradeFromMisses(game, misses);
    }
    case "blank": {
      if (game.type !== "blank") throw new Error("Answer type mismatch");
      if (answers.words.length !== game.items.length) {
        throw new Error("Blank answers incomplete");
      }
      let misses = 0;
      answers.words.forEach((word, index) => {
        const expected = game.items[index]!.answer;
        if (normalizeBlankKey(word) !== normalizeBlankKey(expected)) misses += 1;
      });
      return gradeFromMisses(game, misses);
    }
    case "timeline": {
      if (game.type !== "timeline") throw new Error("Answer type mismatch");
      const check = evaluateTimelineCheck(game, answers.order);
      if (!check.perfect) throw new Error("Timeline is not complete");
      if (game.causalLink) {
        if (!answers.causalChoiceId) throw new Error("Causal choice missing");
        const causal = evaluateTimelineCausal(game, answers.causalChoiceId);
        if (!causal.correct) throw new Error("Causal choice is not complete");
        return gradeFromMisses(game, priorMisses + causal.misses);
      }
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
          (pairIndex) => pairExplanation(game.pairs[pairIndex] ?? {}),
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
    case "case-files":
    case "dispatches":
    case "editorial":
    case "dapitan":
      if (game.type !== answers.type) throw new Error("Answer type mismatch");
      return gradeFromMisses(game, priorMisses);
  }
}
