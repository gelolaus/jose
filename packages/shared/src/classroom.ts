import { z } from "zod";

export const classSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  inviteCode: z.string().min(1).nullable(),
  inviteCodeHint: z.string().min(1).nullable().optional(),
  memberCount: z.number().int().nonnegative(),
  challengesEnabled: z.boolean(),
  archivedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});

export const createClassBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const joinClassBodySchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});

export const gradingPolicySchema = z.enum(["best", "latest", "override"]);
export type GradingPolicy = z.infer<typeof gradingPolicySchema>;
/** Documented default preserves current behavior (best-score mastery). */
export const DEFAULT_GRADING_POLICY: GradingPolicy = "best";
export const DEFAULT_ASSIGNMENT_TIMEZONE = "Asia/Manila";

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const ianaTimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidIanaTimezone, { message: "Invalid IANA timezone" });

export function generateAssignmentLabel(
  moduleTitle: string,
  assignedAt: number,
): string {
  const date = new Date(assignedAt);
  const ymd = Number.isNaN(date.getTime())
    ? "undated"
    : date.toISOString().slice(0, 10);
  const base = moduleTitle.trim() || "Module";
  return `${base} · ${ymd}`.slice(0, 80);
}

export function isAssignmentOverdue(
  dueAt: number | null,
  now: number = Date.now(),
): boolean {
  return dueAt !== null && dueAt !== undefined && now > dueAt;
}

export function formatDueInTimezone(
  dueAt: number | null,
  timeZone: string,
): string | null {
  if (dueAt === null || dueAt === undefined) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-PH", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${fmt.format(new Date(dueAt))} (${timeZone})`;
  } catch {
    return new Date(dueAt).toISOString();
  }
}

export const createAssignmentBodySchema = z.object({
  moduleId: z.string().min(1),
  contentRevisionId: z.string().min(1).optional(),
  // Required for new assignments in the UI; optional here for
  // migration-safe back-compat (service backfills a generated label).
  title: z.string().trim().min(1).max(80).optional(),
  dueAt: z.number().int().positive().nullable().optional(),
  dueTimezone: ianaTimezoneSchema.optional(),
  gradingPolicy: gradingPolicySchema.optional(),
});

export const updateAssignmentBodySchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  dueAt: z.number().int().positive().nullable().optional(),
  dueTimezone: ianaTimezoneSchema.optional(),
  gradingPolicy: gradingPolicySchema.optional(),
});

export const assignmentSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  // Teacher-defined title; older rows backfilled with a generated label.
  title: z.string().min(1).optional().default("Untitled assignment"),
  contentRevisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  dueAt: z.number().int().nullable(),
  dueTimezone: z.string().min(1).optional().default(DEFAULT_ASSIGNMENT_TIMEZONE),
  gradingPolicy: gradingPolicySchema.optional().default(DEFAULT_GRADING_POLICY),
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
  assignmentTitle: z.string().min(1).optional().default("Untitled assignment"),
  contentRevisionId: z.string().min(1),
  members: z.array(classMemberProgressSchema),
  counts: z.object({
    notStarted: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  }),
  misconceptions: z.array(misconceptionSchema),
});

export const studentClassMembershipSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
  joinedAt: z.number().int(),
  assignmentCount: z.number().int().nonnegative(),
});
export type StudentClassMembership = z.infer<typeof studentClassMembershipSchema>;

export type ClassSummary = z.infer<typeof classSummarySchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type StudentAssignment = z.infer<typeof studentAssignmentSchema>;
export type ClassReport = z.infer<typeof classReportSchema>;

export const attemptSummarySchema = z.object({
  numerator: z.number().int().nonnegative().nullable(),
  denominator: z.number().int().positive().nullable(),
  display: z.string().min(1).nullable(),
  attemptAt: z.string().datetime().nullable(),
});

export const gradebookMemberRowSchema = z.object({
  learnerId: z.string().min(1),
  displayName: z.string().min(1),
  admissionEmail: z.string().email(),
  membership: z.enum(["active", "left", "archived"]),
  status: z.enum(["not_started", "in_progress", "completed"]),
  progress: z.string().min(1),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  masteryPercent: z.number().min(0).max(100).nullable(),
  bestScore: z.string().nullable(),
  bestNumerator: z.number().int().nonnegative().nullable(),
  bestDenominator: z.number().int().positive().nullable(),
  latestScore: z.string().nullable(),
  latestNumerator: z.number().int().nonnegative().nullable(),
  latestDenominator: z.number().int().positive().nullable(),
  latestAttemptAt: z.string().datetime().nullable(),
  // Explicit grading policy: effective resolves from best/latest/override.
  effectiveScore: z.string().nullable().optional().default(null),
  effectiveNumerator: z.number().int().nonnegative().nullable().optional().default(null),
  effectiveDenominator: z.number().int().positive().nullable().optional().default(null),
  gradingPolicy: gradingPolicySchema.optional().default(DEFAULT_GRADING_POLICY),
  isOverridden: z.boolean().optional().default(false),
  overrideReason: z.string().nullable().optional().default(null),
  assignedRevisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  assignmentState: z.enum(["active", "archived"]),
  joinedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export const gradebookAssignmentSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  title: z.string().min(1).optional().default("Untitled assignment"),
  contentRevisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  dueAt: z.number().int().nullable(),
  dueTimezone: z.string().min(1).optional().default(DEFAULT_ASSIGNMENT_TIMEZONE),
  gradingPolicy: gradingPolicySchema.optional().default(DEFAULT_GRADING_POLICY),
  assignedAt: z.number().int(),
  archivedAt: z.number().int().nullable(),
  members: z.array(gradebookMemberRowSchema),
  counts: z.object({
    notStarted: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  }),
});

export const gradeOverrideSchema = z.object({
  assignmentId: z.string().min(1),
  learnerId: z.string().min(1),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  createdBy: z.string().min(1),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const createOverrideBodySchema = z.object({
  learnerId: z.string().min(1),
  score: z.number().int().min(0).max(10000),
  maxScore: z.number().int().min(1).max(10000),
  reason: z.string().trim().min(1).max(500),
}).refine((v) => v.score <= v.maxScore, {
  message: "score must not exceed maxScore",
  path: ["score"],
});

export const overrideHistoryEntrySchema = z.object({
  id: z.string().min(1),
  assignmentId: z.string().min(1),
  learnerId: z.string().min(1),
  action: z.enum(["created", "revised", "removed"]),
  score: z.number().int().nonnegative().nullable(),
  maxScore: z.number().int().positive().nullable(),
  reason: z.string().nullable(),
  actorId: z.string().min(1),
  createdAt: z.number().int(),
});

export type GradeOverride = z.infer<typeof gradeOverrideSchema>;
export type OverrideHistoryEntry = z.infer<typeof overrideHistoryEntrySchema>;

export const gradebookResponseSchema = z.object({
  classId: z.string().min(1),
  assignments: z.array(gradebookAssignmentSchema),
  nextCursor: z.string().nullable().default(null),
});

export const classRosterRowSchema = z.object({
  learnerId: z.string().min(1),
  displayName: z.string().min(1),
  admissionEmail: z.string().email(),
  joinedAt: z.string().datetime(),
  membership: z.enum(["active", "left", "archived"]),
  archivedAt: z.string().datetime().nullable(),
});

export const classRosterResponseSchema = z.object({
  classId: z.string().min(1),
  members: z.array(classRosterRowSchema),
  nextCursor: z.string().nullable(),
});

export const gradebookExportOptionsSchema = z.object({
  assignmentId: z.string().min(1),
  format: z.enum(["csv"]).default("csv"),
  maxRows: z.coerce.number().int().min(1).max(5000).default(2000),
});

export const gradebookQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GradebookMemberRow = z.infer<typeof gradebookMemberRowSchema>;
export type GradebookAssignment = z.infer<typeof gradebookAssignmentSchema>;
export type GradebookResponse = z.infer<typeof gradebookResponseSchema>;
export type ClassRosterRow = z.infer<typeof classRosterRowSchema>;
export type ClassRosterResponse = z.infer<typeof classRosterResponseSchema>;

/** Format numerator/denominator as "8 / 10 (80%)" for gradebook display. */
export function formatScore(
  numerator: number | null,
  denominator: number | null,
): string | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  const pct = Math.round((numerator / denominator) * 100);
  return `${numerator} / ${denominator} (${pct}%)`;
}

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
