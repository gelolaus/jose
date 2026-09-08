import { z } from "zod";

/** Exact APC mailbox domains allowed for Jose school accounts. */
export const APC_ADMISSION_DOMAINS = ["apc.edu.ph", "student.apc.edu.ph"] as const;

export const userRoleSchema = z.enum(["student", "teacher", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_ROLES = userRoleSchema.options;

export const authDenialReasonSchema = z.enum([
  "switch_account",
  "missing_email",
  "consent_denied",
  "consent_blocked",
  "cancelled",
  "expired",
  "conflict",
  "not_configured",
  "invalid_callback",
  "suspended",
  "mailbox_required",
  "verification_failed",
  "rate_limited",
]);
export type AuthDenialReason = z.infer<typeof authDenialReasonSchema>;

export const AUTH_DENIAL_MESSAGES: Record<AuthDenialReason, string> = {
  switch_account:
    "Jose school accounts require an APC email. Switch Microsoft account.",
  missing_email:
    "We could not read a trusted email from Microsoft. Enter and verify your APC mailbox to continue.",
  consent_denied: "Microsoft sign-in was cancelled. No Jose session was created.",
  consent_blocked:
    "Your school blocked Microsoft consent for this app. Ask IT, or use APC email-code login when available.",
  cancelled: "Login cancelled. No Jose session was created.",
  expired: "This login step expired. Start Microsoft sign-in again.",
  conflict:
    "This Microsoft account or APC mailbox is already linked to a different Jose account.",
  not_configured:
    "Microsoft login is not configured on this server yet. See docs/auth/microsoft-entra-setup.md.",
  invalid_callback: "Sign-in callback was invalid or forged. Start again from Jose.",
  suspended: "This Jose account is suspended. Contact your instructor or admin.",
  mailbox_required: "Verify your APC mailbox to finish joining Jose.",
  verification_failed: "That verification code is incorrect or no longer valid.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
};

export const authModeSchema = z.enum(["disabled", "mock", "microsoft"]);
export type AuthMode = z.infer<typeof authModeSchema>;

/** Cookie that carries the opaque Jose session token. Mirrors SESSION_COOKIE in the API. */
export const SESSION_COOKIE_NAME = "jose_session";

export const AVATAR_IDS = [
  "compass",
  "sun",
  "book",
  "star",
  "leaf",
  "ship",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const avatarIdSchema = z.enum(AVATAR_IDS);

export const DEFAULT_AVATAR_ID: AvatarId = "compass";
export const DEFAULT_DISPLAY_NAME = "Explorer";

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export function normalizeDisplayName(raw: string): string | null {
  const displayName = raw.trim();
  if (displayName.length < 1 || displayName.length > 20) return null;
  return displayName;
}

export const authStatusSchema = z.object({
  mode: authModeSchema,
  microsoftConfigured: z.boolean(),
  mockEnabled: z.boolean(),
  demoMode: z.boolean().default(false),
  allowedDomains: z.array(z.string()),
  webOrigin: z.string().nullable(),
  /**
   * True only when THIS request is a local non-production loopback call.
   * Clients must not infer this from window.location.
   */
  localDevAccess: z.boolean().default(false),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  role: userRoleSchema,
  admissionEmail: z.string().email(),
  displayName: z.string().min(1),
  suspended: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Learner profile attached to /auth/me once a session exists. */
export const authLearnerProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  avatarId: avatarIdSchema,
  streak: z.number().int().nonnegative(),
  hearts: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  heartsUpdatedAt: z.number().int().nonnegative().optional(),
  nextHeartAt: z.number().int().nonnegative().nullable().optional(),
  serverNow: z.number().int().nonnegative().optional(),
});
export type AuthLearnerProfile = z.infer<typeof authLearnerProfileSchema>;

export const authMeResponseSchema = z.object({
  authenticated: z.boolean(),
  user: sessionUserSchema.nullable(),
  learner: authLearnerProfileSchema.nullable().default(null),
  demoMode: z.boolean().default(false),
});
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const pendingAdmissionStatusSchema = z.object({
  pendingId: z.string().min(1),
  status: z.enum(["pending_mailbox"]),
  candidateEmail: z.string().email().nullable(),
  claimedEmail: z.string().email().nullable(),
  canChooseEmail: z.boolean(),
  message: z.string(),
});
export type PendingAdmissionStatus = z.infer<typeof pendingAdmissionStatusSchema>;

export const requestMailboxBodySchema = z.object({
  email: z.string().email().optional(),
});
export type RequestMailboxBody = z.infer<typeof requestMailboxBodySchema>;

export const verifyMailboxBodySchema = z.object({
  code: z.string().min(4).max(12),
});
export type VerifyMailboxBody = z.infer<typeof verifyMailboxBodySchema>;

export const profilePatchBodySchema = z.object({
  displayName: z.string().min(1).max(20).optional(),
  avatarId: avatarIdSchema.optional(),
});
export type ProfilePatchBody = z.infer<typeof profilePatchBodySchema>;

/** One-time first-admin creation, gated by operator-only environment secrets. */
export const adminBootstrapBodySchema = z.object({
  token: z.string().min(1),
  displayName: z.string().trim().min(1).max(80).optional(),
});
export type AdminBootstrapBody = z.infer<typeof adminBootstrapBodySchema>;

/** Admins may hand out student/teacher only; admin never travels over this route. */
export const grantRoleBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "teacher"]),
});
export type GrantRoleBody = z.infer<typeof grantRoleBodySchema>;

export const adminUserQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["student", "teacher"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;

export const adminUserSummarySchema = z.object({
  id: z.string().min(1),
  admissionEmail: z.string().email(),
  displayName: z.string().min(1),
  role: userRoleSchema,
  staffEligible: z.boolean(),
});
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserSummarySchema),
  nextCursor: z.string().nullable(),
});
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

/** Exact mailbox allowed to use the localhost-only development login. */
export const LOCAL_DEV_TEST_EMAIL = "arlaus@student.apc.edu.ph";

export const localDevRoleSchema = z.enum(["student", "teacher", "admin"]);
export type LocalDevRole = z.infer<typeof localDevRoleSchema>;

/** Local role switch body. Only the Arlaus localhost shortcut may send admin. */
export const localDevRoleBodySchema = z
  .object({
    role: localDevRoleSchema,
  })
  .strict();
export type LocalDevRoleBody = z.infer<typeof localDevRoleBodySchema>;

export const APC_STAFF_TEACHER_DOMAIN = "apc.edu.ph";

export function normalizeAdmissionEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return trimmed.toLowerCase();
  return `${trimmed.slice(0, at).toLowerCase()}@${trimmed.slice(at + 1).toLowerCase()}`;
}

/** Exact mailbox domain after the last `@`. Never a suffix or includes match. */
export function admissionMailboxDomain(email: string): string {
  const normalized = normalizeAdmissionEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 0 || at === normalized.length - 1) return "";
  return normalized.slice(at + 1);
}

/** Staff teacher grants require the verified admission mailbox's exact domain. */
export function isExactStaffTeacherDomain(email: string): boolean {
  return admissionMailboxDomain(email) === APC_STAFF_TEACHER_DOMAIN;
}

export function isLocalDevTestEmail(email: string): boolean {
  return normalizeAdmissionEmail(email) === LOCAL_DEV_TEST_EMAIL;
}

export const grantCollaboratorBodySchema = z.object({
  email: z.string().email(),
});
export type GrantCollaboratorBody = z.infer<typeof grantCollaboratorBodySchema>;

export function canAccessTeacherStudio(role: UserRole | null | undefined): boolean {
  return role === "teacher" || role === "admin";
}

/** Domain membership never implies teacher rights; admission always starts as student. */
export function roleFromAdmissionEmail(_email: string): UserRole {
  return "student";
}
