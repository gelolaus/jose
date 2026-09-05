import { z } from "zod";
import { continueLearningSchema } from "./continue";
import { gameContentSchema, lessonContentSchema } from "./games";
import {
  gameTypeSchema,
  hexColorSchema,
  learnerSchema,
  nodeKindSchema,
  nodeStatusSchema,
} from "./path";

export const moduleCardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  coverColor: hexColorSchema,
  featured: z.boolean(),
  published: z.boolean(),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  nextLevelId: z.string().min(1).nullable(),
  nextLevelTitle: z.string().min(1).nullable(),
  nextSectionTitle: z.string().min(1).nullable(),
});

export const modulesResponseSchema = z.object({
  learner: learnerSchema,
  modules: z.array(moduleCardSchema),
  continueLearning: continueLearningSchema.nullable(),
});

export const playLevelMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  status: nodeStatusSchema,
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  sectionTitle: z.string().min(1),
  gameType: gameTypeSchema.nullable(),
});

export const playLevelResponseSchema = z.object({
  level: playLevelMetaSchema,
  learner: learnerSchema,
  lesson: lessonContentSchema.optional(),
  game: gameContentSchema.optional(),
  chest: z.object({ message: z.string().min(1) }).optional(),
  nextLevelId: z.string().min(1).nullable(),
  mapHref: z.string().min(1),
});

export const attemptBodySchema = z.object({
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  payload: z.unknown().optional(),
  /** learning = core path (unlimited); arcade_challenge spends optional hearts */
  mode: z.enum(["learning", "arcade_challenge"]).optional(),
});

export const missResponseSchema = z.object({
  learner: learnerSchema,
});

export const attemptResultSchema = z.object({
  completed: z.boolean(),
  firstTime: z.boolean(),
  learner: learnerSchema,
  nextLevelId: z.string().min(1).nullable(),
  continueHref: z.string().min(1),
});

export type ModuleCard = z.infer<typeof moduleCardSchema>;
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;
export type PlayLevelResponse = z.infer<typeof playLevelResponseSchema>;
export type AttemptBody = z.infer<typeof attemptBodySchema>;
export type MissResponse = z.infer<typeof missResponseSchema>;
