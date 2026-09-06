import { z } from "zod";
import { chestContentSchema } from "./artifacts";
import { gameContentSchema, lessonContentSchema } from "./games";
import { gameTypeSchema, hexColorSchema, nodeKindSchema } from "./path";

export const revisionLevelSnapshotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  gameType: gameTypeSchema.nullable(),
  sortOrder: z.number().int(),
  lesson: lessonContentSchema.nullable().optional(),
  game: gameContentSchema.nullable().optional(),
  chest: chestContentSchema.nullable().optional(),
});

export const revisionSectionSnapshotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  themeColor: hexColorSchema,
  sortOrder: z.number().int(),
  levels: z.array(revisionLevelSnapshotSchema),
});

export const moduleRevisionSnapshotSchema = z.object({
  module: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    coverColor: hexColorSchema,
    objectives: z.string().nullable(),
  }),
  sections: z.array(revisionSectionSnapshotSchema),
});

export const moduleRevisionSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  createdAt: z.number().int(),
  createdBy: z.string().min(1),
  publishedAt: z.number().int().nullable(),
  note: z.string().nullable(),
});

export type ModuleRevisionSnapshot = z.infer<typeof moduleRevisionSnapshotSchema>;
export type ModuleRevision = z.infer<typeof moduleRevisionSchema>;
