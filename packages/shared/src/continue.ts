import { z } from "zod";
import { nodeKindSchema } from "./path";

export const continueActionKindSchema = z.enum([
  "resume",
  "review",
  "explore",
]);

export const continueLearningSchema = z.object({
  kind: continueActionKindSchema,
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  sectionTitle: z.string().min(1),
  levelId: z.string().min(1),
  levelTitle: z.string().min(1),
  levelKind: nodeKindSchema,
  approximateMinutes: z.number().int().positive(),
  /** Reserved for classroom assignments; null until classes ship. */
  assignmentLabel: z.string().nullable(),
  href: z.string().min(1),
  reason: z.string().min(1),
});

export type ContinueLearning = z.infer<typeof continueLearningSchema>;
export type ContinueActionKind = z.infer<typeof continueActionKindSchema>;

export function approximateMinutesForKind(
  kind: "lesson" | "game" | "chest",
): number {
  if (kind === "lesson") return 5;
  if (kind === "game") return 4;
  return 1;
}

export type ContinueCandidate = {
  moduleId: string;
  moduleTitle: string;
  featured: boolean;
  sectionTitle: string;
  levelId: string;
  levelTitle: string;
  levelKind: "lesson" | "game" | "chest";
  completedCount: number;
  totalCount: number;
};

/**
 * Pick the best resume target: featured module in progress first, then any
 * in-progress module, else review/explore when everything is complete.
 */
export function pickContinueLearning(
  candidates: ContinueCandidate[],
  reviewHref = "/practice",
): ContinueLearning | null {
  if (candidates.length === 0) return null;

  const inProgress = candidates.filter((c) => c.completedCount < c.totalCount);
  const pick =
    inProgress.find((c) => c.featured) ??
    inProgress.sort(
      (a, b) => b.completedCount / b.totalCount - a.completedCount / a.totalCount,
    )[0];

  if (pick) {
    return {
      kind: "resume",
      moduleId: pick.moduleId,
      moduleTitle: pick.moduleTitle,
      sectionTitle: pick.sectionTitle,
      levelId: pick.levelId,
      levelTitle: pick.levelTitle,
      levelKind: pick.levelKind,
      approximateMinutes: approximateMinutesForKind(pick.levelKind),
      assignmentLabel: null,
      href: `/learn/${pick.moduleId}/${pick.levelId}`,
      reason: `Continue in ${pick.sectionTitle}`,
    };
  }

  const featured = candidates.find((c) => c.featured) ?? candidates[0]!;
  return {
    kind: "review",
    moduleId: featured.moduleId,
    moduleTitle: featured.moduleTitle,
    sectionTitle: "Course complete",
    levelId: featured.levelId,
    levelTitle: "Personalized practice",
    levelKind: "game",
    approximateMinutes: 8,
    assignmentLabel: null,
    href: reviewHref,
    reason: "You finished the path — review weak spots or explore again",
  };
}

export function nextLevelAfter(
  orderedLevelIds: string[],
  currentLevelId: string,
): string | null {
  const index = orderedLevelIds.indexOf(currentLevelId);
  if (index < 0) return null;
  return orderedLevelIds[index + 1] ?? null;
}
