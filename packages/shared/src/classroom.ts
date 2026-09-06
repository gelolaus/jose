import { z } from "zod";

export const classSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  inviteCode: z.string().min(1).nullable(),
  memberCount: z.number().int().nonnegative(),
  archivedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});

export const createClassBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const joinClassBodySchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});

export const createAssignmentBodySchema = z.object({
  moduleId: z.string().min(1),
  contentRevisionId: z.string().min(1).optional(),
  dueAt: z.number().int().positive().optional(),
});

export const assignmentSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  contentRevisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  dueAt: z.number().int().nullable(),
  assignedAt: z.number().int(),
  archivedAt: z.number().int().nullable(),
});

export const studentAssignmentSchema = assignmentSchema.extend({
  status: z.enum(["not_started", "in_progress", "completed"]),
  nextLevelId: z.string().nullable(),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export const classMemberProgressSchema = z.object({
  learnerId: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum(["not_started", "in_progress", "completed"]),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  masteryPercent: z.number().min(0).max(100).nullable(),
  latestAttemptAt: z.number().int().nullable(),
  bestScore: z.number().int().nullable(),
  bestMaxScore: z.number().int().nullable(),
  archivedAt: z.number().int().nullable(),
});

export const misconceptionSchema = z.object({
  levelId: z.string().min(1),
  levelTitle: z.string().min(1),
  label: z.string().min(1),
  count: z.number().int().positive(),
});

export const classReportSchema = z.object({
  classId: z.string().min(1),
  assignmentId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  contentRevisionId: z.string().min(1),
  members: z.array(classMemberProgressSchema),
  counts: z.object({
    notStarted: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  }),
  misconceptions: z.array(misconceptionSchema),
});

export type ClassSummary = z.infer<typeof classSummarySchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type StudentAssignment = z.infer<typeof studentAssignmentSchema>;
export type ClassReport = z.infer<typeof classReportSchema>;

/** Prefix formula-like CSV cells so spreadsheets do not execute them. */
export function csvSafeCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  const needsFormulaGuard = /^[=+\-@]/.test(escaped) || /^[\t\r]/.test(escaped);
  const guarded = needsFormulaGuard ? `'${escaped}` : escaped;
  if (/[",\n\r]/.test(guarded)) return `"${guarded}"`;
  return guarded;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvSafeCell).join(",")).join("\n");
}
