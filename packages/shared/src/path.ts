import { z } from "zod";

export const nodeStatusSchema = z.enum(["completed", "current", "locked"]);
export const nodeKindSchema = z.enum(["lesson", "chest"]);
export const nodeIconSchema = z.enum(["check", "book", "star", "chest"]);
export const nodePositionSchema = z.enum(["left", "center", "right"]);

export const levelNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  status: nodeStatusSchema,
  icon: nodeIconSchema,
  position: nodePositionSchema,
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  nodes: z.array(levelNodeSchema).min(1),
});

export const pathResponseSchema = z.object({
  course: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
  }),
  learner: z.object({
    displayName: z.string().min(1),
    streak: z.number().int().nonnegative(),
    hearts: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
  }),
  sections: z.array(sectionSchema).min(1),
});

export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type NodeIcon = z.infer<typeof nodeIconSchema>;
export type NodePosition = z.infer<typeof nodePositionSchema>;
export type LevelNode = z.infer<typeof levelNodeSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type PathResponse = z.infer<typeof pathResponseSchema>;
