import { z } from "zod";

export const nodeStatusSchema = z.enum(["completed", "current", "locked"]);
export const nodeKindSchema = z.enum(["lesson", "game", "chest"]);
export const nodeIconSchema = z.enum(["check", "book", "star", "chest", "game"]);
export const nodePositionSchema = z.enum(["left", "center", "right"]);
export const gameTypeSchema = z.enum([
  "quiz",
  "memory",
  "timeline",
  "blank",
  "sort",
]);

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const levelNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: nodeKindSchema,
  status: nodeStatusSchema,
  icon: nodeIconSchema,
  position: nodePositionSchema,
  gameType: gameTypeSchema.nullable().optional(),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  themeColor: hexColorSchema,
  nodes: z.array(levelNodeSchema).min(1),
});

export const pathModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  coverColor: hexColorSchema,
  featured: z.boolean(),
});

export const learnerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  avatarId: z.string().min(1).optional(),
  streak: z.number().int().nonnegative(),
  hearts: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
});

export const pathResponseSchema = z.object({
  module: pathModuleSchema,
  learner: learnerSchema,
  sections: z.array(sectionSchema).min(1),
});

export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type NodeIcon = z.infer<typeof nodeIconSchema>;
export type NodePosition = z.infer<typeof nodePositionSchema>;
export type GameType = z.infer<typeof gameTypeSchema>;
export type LevelNode = z.infer<typeof levelNodeSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type PathModule = z.infer<typeof pathModuleSchema>;
export type Learner = z.infer<typeof learnerSchema>;
export type PathResponse = z.infer<typeof pathResponseSchema>;

export const DEMO_LEARNER_ID = "demo-student";

export function pathPosition(index: number): NodePosition {
  const lanes: NodePosition[] = ["center", "left", "right"];
  return lanes[index % 3]!;
}

export function nodeIconFor(kind: NodeKind, status: NodeStatus): NodeIcon {
  if (status === "completed") return "check";
  if (kind === "chest") return "chest";
  if (kind === "game") return "game";
  return "book";
}
