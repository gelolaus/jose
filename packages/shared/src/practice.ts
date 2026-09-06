import { z } from "zod";
import { gameContentSchema } from "./games";
import { gameTypeSchema, nodeKindSchema } from "./path";

export const practiceReasonKindSchema = z.enum([
  "recent_miss",
  "due_for_review",
  "completed_reinforce",
  "instructor_tag",
]);

export const practiceItemSchema = z.object({
  id: z.string().min(1),
  levelId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  sectionTitle: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  gameType: gameTypeSchema.nullable(),
  reasonKind: practiceReasonKindSchema,
  reason: z.string().min(1),
  href: z.string().min(1),
  dueAt: z.number().int().nullable(),
});

export const practiceReviewResponseSchema = z.object({
  items: z.array(practiceItemSchema),
  rules: z.array(z.string().min(1)),
  emptyMessage: z.string().min(1),
});

export const practicePlayResponseSchema = z.object({
  levelId: z.string().min(1),
  title: z.string().min(1),
  moduleId: z.string().min(1),
  game: gameContentSchema,
});

export const practiceAttemptBodySchema = z.object({
  levelId: z.string().min(1),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  payload: z.unknown().optional(),
});

export const practiceAttemptResultSchema = z.object({
  saved: z.literal(true),
  marksAssignmentComplete: z.literal(false),
  learner: z.object({
    id: z.string(),
    displayName: z.string(),
    streak: z.number().int().nonnegative(),
    hearts: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
  }),
});

export type PracticeItem = z.infer<typeof practiceItemSchema>;
export type PracticeReviewResponse = z.infer<typeof practiceReviewResponseSchema>;
export type PracticePlayResponse = z.infer<typeof practicePlayResponseSchema>;

/** Transparent scheduling: miss → +1d, again → +3d, then +7d. */
export const PRACTICE_INTERVALS_MS = [
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const;

export const PRACTICE_RULES = [
  "Recent mistakes on path games are queued first.",
  "Completed activities return after 1 day, then 3 days, then 7 days.",
  "Instructor tags (when present) outrank reinforce-only items.",
  "Practice saves do not complete formal path assignments or add path XP.",
] as const;

export function nextReviewAt(
  priorReviewCount: number,
  fromMs: number,
): number {
  const index = Math.min(
    priorReviewCount,
    PRACTICE_INTERVALS_MS.length - 1,
  );
  return fromMs + PRACTICE_INTERVALS_MS[index]!;
}

export type MissSignal = {
  levelId: string;
  createdAt: number;
};

export type CompletionSignal = {
  levelId: string;
  completedAt: number;
};

export type ReviewState = {
  levelId: string;
  reviewCount: number;
  nextDueAt: number | null;
};

export function buildPracticeQueue(input: {
  now: number;
  misses: MissSignal[];
  completions: CompletionSignal[];
  reviews: ReviewState[];
  levelMeta: Record<
    string,
    {
      moduleId: string;
      moduleTitle: string;
      sectionTitle: string;
      title: string;
      kind: "lesson" | "game" | "chest";
      gameType: "quiz" | "memory" | "timeline" | "blank" | "sort" | null;
      instructorTags?: string[];
    }
  >;
  limit?: number;
}): PracticeItem[] {
  const limit = input.limit ?? 8;
  const reviewByLevel = new Map(
    input.reviews.map((r) => [r.levelId, r] as const),
  );
  const items: PracticeItem[] = [];
  const seen = new Set<string>();

  const recentMisses = [...input.misses].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  for (const miss of recentMisses) {
    if (seen.has(miss.levelId)) continue;
    const meta = input.levelMeta[miss.levelId];
    if (!meta || meta.kind !== "game") continue;
    seen.add(miss.levelId);
    items.push({
      id: `miss-${miss.levelId}`,
      levelId: miss.levelId,
      moduleId: meta.moduleId,
      moduleTitle: meta.moduleTitle,
      sectionTitle: meta.sectionTitle,
      title: meta.title,
      kind: meta.kind,
      gameType: meta.gameType,
      reasonKind: "recent_miss",
      reason: "You missed this recently on the path",
      href: `/practice/review/${miss.levelId}`,
      dueAt: null,
    });
    if (items.length >= limit) return items;
  }

  for (const [levelId, meta] of Object.entries(input.levelMeta)) {
    const tags = meta.instructorTags ?? [];
    if (tags.length === 0 || seen.has(levelId)) continue;
    if (meta.kind !== "game") continue;
    seen.add(levelId);
    items.push({
      id: `tag-${levelId}`,
      levelId,
      moduleId: meta.moduleId,
      moduleTitle: meta.moduleTitle,
      sectionTitle: meta.sectionTitle,
      title: meta.title,
      kind: meta.kind,
      gameType: meta.gameType,
      reasonKind: "instructor_tag",
      reason: `Instructor tagged for review: ${tags.join(", ")}`,
      href: `/practice/review/${levelId}`,
      dueAt: null,
    });
    if (items.length >= limit) return items;
  }

  const due = input.reviews
    .filter((r) => r.nextDueAt != null && r.nextDueAt <= input.now)
    .sort((a, b) => (a.nextDueAt ?? 0) - (b.nextDueAt ?? 0));
  for (const review of due) {
    if (seen.has(review.levelId)) continue;
    const meta = input.levelMeta[review.levelId];
    if (!meta || meta.kind !== "game") continue;
    seen.add(review.levelId);
    items.push({
      id: `due-${review.levelId}`,
      levelId: review.levelId,
      moduleId: meta.moduleId,
      moduleTitle: meta.moduleTitle,
      sectionTitle: meta.sectionTitle,
      title: meta.title,
      kind: meta.kind,
      gameType: meta.gameType,
      reasonKind: "due_for_review",
      reason: "Due for spaced review",
      href: `/practice/review/${review.levelId}`,
      dueAt: review.nextDueAt,
    });
    if (items.length >= limit) return items;
  }

  const completedGames = input.completions
    .filter((c) => input.levelMeta[c.levelId]?.kind === "game")
    .sort((a, b) => b.completedAt - a.completedAt);
  for (const completion of completedGames) {
    if (seen.has(completion.levelId)) continue;
    const meta = input.levelMeta[completion.levelId];
    if (!meta) continue;
    const state = reviewByLevel.get(completion.levelId);
    if (state?.nextDueAt && state.nextDueAt > input.now) continue;
    seen.add(completion.levelId);
    items.push({
      id: `reinforce-${completion.levelId}`,
      levelId: completion.levelId,
      moduleId: meta.moduleId,
      moduleTitle: meta.moduleTitle,
      sectionTitle: meta.sectionTitle,
      title: meta.title,
      kind: meta.kind,
      gameType: meta.gameType,
      reasonKind: "completed_reinforce",
      reason: "Reinforce a game you already finished",
      href: `/practice/review/${completion.levelId}`,
      dueAt: null,
    });
    if (items.length >= limit) return items;
  }

  return items;
}
