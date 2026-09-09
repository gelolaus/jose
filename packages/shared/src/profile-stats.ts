import { z } from "zod";
import { learnerSchema } from "./path";
import { XP_RULES_COPY, STREAK_RULES_COPY } from "./streak";

export const achievementIdSchema = z.enum([
  "on-the-path",
  "first-treasure",
  "first-chapter-clear",
  "course-complete",
]);

export const achievementSchema = z.object({
  id: achievementIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  unlocked: z.boolean(),
  earnedAt: z.number().int().nullable(),
});

export const moduleProgressSummarySchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1),
  featured: z.boolean(),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  coverColor: z.string(),
});

export const profileStatsResponseSchema = z.object({
  learner: learnerSchema,
  modules: z.array(moduleProgressSummarySchema),
  totals: z.object({
    completedLevels: z.number().int().nonnegative(),
    totalLevels: z.number().int().nonnegative(),
    chestsOpened: z.number().int().nonnegative(),
  }),
  achievements: z.array(achievementSchema),
  rules: z.object({
    xp: z.string(),
    streak: z.string(),
    hearts: z.string(),
  }),
});

export type AchievementId = z.infer<typeof achievementIdSchema>;
export type Achievement = z.infer<typeof achievementSchema>;
export type ProfileStatsResponse = z.infer<typeof profileStatsResponseSchema>;

export const HEARTS_RULES_COPY =
  "Lives refill one every 10 minutes, up to five. Finishing a new lesson shortens the wait by 2 minutes. Required lessons, class assignments, and revisiting never spend them.";

export const PROFILE_RULES = {
  xp: XP_RULES_COPY,
  streak: STREAK_RULES_COPY,
  hearts: HEARTS_RULES_COPY,
} as const;

export type AchievementEvidence = {
  hasAnyProgress: boolean;
  chestsOpened: number;
  anyChapterFullyComplete: boolean;
  allPublishedComplete: boolean;
  previouslyEarned: ReadonlySet<string>;
  earnedAtById?: ReadonlyMap<string, number>;
};

/** Achievements are monotonic: once earned (or previously persisted), they stay unlocked. */
export function deriveAchievements(evidence: AchievementEvidence): Achievement[] {
  const catalog: Array<{
    id: AchievementId;
    title: string;
    description: string;
    qualifies: boolean;
  }> = [
    {
      id: "on-the-path",
      title: "On the path",
      description: "Started learning on any published module",
      qualifies: evidence.hasAnyProgress,
    },
    {
      id: "first-treasure",
      title: "First treasure",
      description: "Opened a chest along the path",
      qualifies: evidence.chestsOpened > 0,
    },
    {
      id: "first-chapter-clear",
      title: "Chapter cleared",
      description: "Finished every level in at least one chapter",
      qualifies: evidence.anyChapterFullyComplete,
    },
    {
      id: "course-complete",
      title: "Course complete",
      description: "Finished every published module level",
      qualifies: evidence.allPublishedComplete,
    },
  ];

  return catalog.map((entry) => {
    const unlocked =
      entry.qualifies || evidence.previouslyEarned.has(entry.id);
    return {
      id: entry.id,
      title: entry.title,
      description: entry.description,
      unlocked,
      earnedAt: unlocked
        ? (evidence.earnedAtById?.get(entry.id) ?? null)
        : null,
    };
  });
}
