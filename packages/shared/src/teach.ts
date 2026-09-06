import { z } from "zod";
import { chestContentSchema } from "./artifacts";
import {
  applyTemplateBodySchema,
  createAssetBodySchema,
  createFromWizardBodySchema,
  duplicateBodySchema,
  importQuestionsBodySchema,
  importQuestionsResultSchema,
  teachAssetSchema,
} from "./authoring";
import {
  gameContentSchema,
  lessonContentSchema,
} from "./games";
import {
  lessonBlocksSchema,
  rejectUnsafeLessonEmbeds,
} from "./lesson-blocks";
import { gameTypeSchema, hexColorSchema, nodeKindSchema } from "./path";

export const teachModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  coverColor: hexColorSchema,
  featured: z.boolean(),
  published: z.boolean(),
  sortOrder: z.number().int(),
  sectionCount: z.number().int().nonnegative(),
  levelCount: z.number().int().nonnegative(),
  /** Null for seeded modules, which only admins may edit. */
  ownerUserId: z.string().nullable(),
  updatedAt: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  objectives: z.string().nullable(),
  authorReviewedAt: z.number().int().nullable(),
  publishedRevisionId: z.string().min(1).nullable(),
  archivedAt: z.number().int().nullable(),
  trashedAt: z.number().int().nullable(),
});

export const teachLevelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  gameType: gameTypeSchema.nullable(),
  sortOrder: z.number().int(),
  revision: z.number().int().nonnegative(),
});

export const teachSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  themeColor: hexColorSchema,
  sortOrder: z.number().int(),
  levels: z.array(teachLevelSchema),
});

export const teachModuleDetailSchema = teachModuleSchema.extend({
  sections: z.array(teachSectionSchema),
});

export const createModuleBodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(160),
  coverColor: hexColorSchema,
});

export const patchModuleBodySchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: z.string().trim().min(1).max(160).optional(),
  coverColor: hexColorSchema.optional(),
  published: z.boolean().optional(),
  objectives: z.string().trim().max(2000).nullable().optional(),
  authorReviewed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});

export const createSectionBodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(160),
  themeColor: hexColorSchema,
});

export const patchSectionBodySchema = createSectionBodySchema.partial();

export const createLevelBodySchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    kind: z.enum(["lesson", "game"]),
    gameType: gameTypeSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.kind === "game" && !body.gameType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "gameType is required for game levels",
        path: ["gameType"],
      });
    }
  });

export const patchLevelBodySchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});

export const moveBodySchema = z
  .object({
    direction: z.enum(["up", "down"]).optional(),
    targetSectionId: z.string().min(1).optional(),
    beforeLevelId: z.string().min(1).nullable().optional(),
    index: z.number().int().nonnegative().optional(),
  })
  .refine(
    (body) =>
      body.direction !== undefined ||
      body.targetSectionId !== undefined ||
      body.beforeLevelId !== undefined ||
      body.index !== undefined,
    { message: "Provide a move direction, target section, beforeLevelId, or index" },
  );

export const moveSectionBodySchema = z
  .object({
    direction: z.enum(["up", "down"]).optional(),
    index: z.number().int().nonnegative().optional(),
  })
  .refine((body) => body.direction !== undefined || body.index !== undefined, {
    message: "Provide a direction or index",
  });

export const bulkMoveBodySchema = z.object({
  levelIds: z.array(z.string().min(1)).min(1).max(50),
  targetSectionId: z.string().min(1),
  beforeLevelId: z.string().min(1).nullable().optional(),
});

export const permanentDeleteBodySchema = z.object({
  confirm: z.literal(true),
});

export const putLessonBodySchema = z
  .object({
    markdown: z.string().optional(),
    youtubeUrl: z.string().optional(),
    blocks: lessonBlocksSchema.optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.markdown === undefined && body.blocks === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide markdown or blocks",
        path: ["markdown"],
      });
    }
    if (body.blocks) {
      const unsafe = rejectUnsafeLessonEmbeds(body.blocks);
      if (unsafe) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: unsafe,
          path: ["blocks"],
        });
      }
    }
  });

export const putGameBodySchema = gameContentSchema;

export const putGameMutationSchema = z.object({
  expectedRevision: z.number().int().nonnegative().optional(),
  game: gameContentSchema.optional(),
}).passthrough();

export const putChestBodySchema = chestContentSchema;

export const teachLevelDetailSchema = teachLevelSchema.extend({
  moduleId: z.string().min(1),
  sectionId: z.string().min(1),
  lesson: lessonContentSchema.nullable(),
  game: gameContentSchema.nullable(),
  chest: chestContentSchema.nullable(),
});

export const CONFLICT_CODE = "CONTENT_CONFLICT" as const;

export {
  applyTemplateBodySchema,
  createAssetBodySchema,
  createFromWizardBodySchema,
  duplicateBodySchema,
  importQuestionsBodySchema,
  importQuestionsResultSchema,
  teachAssetSchema,
};

export type TeachModule = z.infer<typeof teachModuleSchema>;
export type TeachModuleDetail = z.infer<typeof teachModuleDetailSchema>;
export type TeachLevelDetail = z.infer<typeof teachLevelDetailSchema>;
