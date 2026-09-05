import { z } from "zod";

export const accountRoleSchema = z.enum(["student", "teacher", "admin"]);
export type AccountRole = z.infer<typeof accountRoleSchema>;

export const accountStatusSchema = z.enum(["active", "suspended"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const authAccountSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: accountRoleSchema,
  status: accountStatusSchema,
});
export type AuthAccount = z.infer<typeof authAccountSchema>;

export const meResponseSchema = z.object({
  account: authAccountSchema.nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const adminBootstrapBodySchema = z.object({
  token: z.string().min(1),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const grantRoleBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "teacher"]),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const grantCollaboratorBodySchema = z.object({
  email: z.string().email(),
});

export const TEACHER_ROLES: ReadonlySet<AccountRole> = new Set([
  "teacher",
  "admin",
]);

export function canAccessTeacherStudio(role: AccountRole | null | undefined) {
  return role === "teacher" || role === "admin";
}

/** Domain membership never implies teacher rights. */
export function roleFromAdmissionEmail(_email: string): AccountRole {
  return "student";
}
