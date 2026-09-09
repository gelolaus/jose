import { z } from "zod";
import {
  assessmentGameSchema,
  attemptInfoSchema,
} from "./assessment";
import { chestContentSchema } from "./artifacts";
import { MAX_ATTEMPT_PAYLOAD_BYTES, serializedJsonBytes } from "./limits";
import { continueLearningSchema } from "./continue";
import { lessonContentSchema } from "./games";
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
  nextLevelId: z.string().min(1).nullable().optional(),
  nextLevelTitle: z.string().min(1).nullable().optional(),
  nextSectionTitle: z.string().min(1).nullable().optional(),
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
  /** Assessment delivery only — answer keys are stripped. */
  game: assessmentGameSchema.optional(),
  attempt: attemptInfoSchema.optional(),
  chest: chestContentSchema.optional(),
  contentRevisionId: z.string().min(1).nullable().optional(),
  nextLevelId: z.string().min(1).nullable().optional(),
  mapHref: z.string().min(1).optional(),
});

/** Legacy client-scored posts are rejected. */
export const attemptBodySchema = z
  .object({
    score: z.number().int().nonnegative().optional(),
    maxScore: z.number().int().nonnegative().optional(),
    payload: z.unknown().optional(),
    clientAttemptId: z.string().trim().min(1).max(128).optional(),
    contentRevisionId: z.string().min(1).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.score !== undefined || body.maxScore !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Client scores are not accepted; finish the server-issued attempt instead",
      });
    }
    if (body.payload === undefined) return;
    const size = serializedJsonBytes(body.payload);
    if (size == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Attempt payload must be JSON-serializable",
        path: ["payload"],
      });
      return;
    }
    if (size > MAX_ATTEMPT_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Attempt payload exceeds ${MAX_ATTEMPT_PAYLOAD_BYTES} bytes`,
        path: ["payload"],
      });
    }
  });

export const missBodySchema = z.object({
  /** Stable key so retries of the same miss do not spend another heart. */
  idempotencyKey: z.string().trim().min(1).max(128),
});

export const missResponseSchema = z.object({
  learner: learnerSchema,
});

export const attemptResultSchema = z.object({
  completed: z.boolean(),
  firstTime: z.boolean(),
  learner: learnerSchema,
  nextLevelId: z.string().min(1).nullable().optional(),
  continueHref: z.string().min(1).optional(),
  contentRevisionId: z.string().min(1).nullable().optional(),
  artifactAwarded: z.boolean().optional(),
  lessonCreditApplied: z.boolean().optional(),
});

export type ModuleCard = z.infer<typeof moduleCardSchema>;
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;
export type PlayLevelResponse = z.infer<typeof playLevelResponseSchema>;
export type AttemptBody = z.infer<typeof attemptBodySchema>;
export type MissBody = z.infer<typeof missBodySchema>;
export type MissResponse = z.infer<typeof missResponseSchema>;
