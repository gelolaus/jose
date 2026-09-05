import { z } from "zod";
import { chestContentSchema } from "./artifacts";
import { gameContentSchema, lessonContentSchema } from "./games";
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
});

export const teachLevelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  gameType: gameTypeSchema.nullable(),
  sortOrder: z.number().int(),
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
  sortOrder: z.number().int().optional(),
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
});

export const moveBodySchema = z.object({
  direction: z.enum(["up", "down"]),
});

export const putLessonBodySchema = z.object({
  markdown: z.string(),
  youtubeUrl: z.string().optional(),
});

export const putGameBodySchema = gameContentSchema;

export const putChestBodySchema = chestContentSchema;

export const teachLevelDetailSchema = teachLevelSchema.extend({
  moduleId: z.string().min(1),
  sectionId: z.string().min(1),
  lesson: lessonContentSchema.nullable(),
  game: gameContentSchema.nullable(),
  chest: chestContentSchema.nullable(),
});

export type TeachModule = z.infer<typeof teachModuleSchema>;
export type TeachModuleDetail = z.infer<typeof teachModuleDetailSchema>;
export type TeachLevelDetail = z.infer<typeof teachLevelDetailSchema>;
