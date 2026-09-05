import { z } from "zod";

/** Exact APC mailbox domains allowed for Jose school accounts. */
export const APC_ADMISSION_DOMAINS = ["apc.edu.ph", "student.apc.edu.ph"] as const;

export const userRoleSchema = z.enum(["student", "teacher", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

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

export const authStatusSchema = z.object({
  mode: authModeSchema,
  microsoftConfigured: z.boolean(),
  mockEnabled: z.boolean(),
  allowedDomains: z.array(z.string()),
  webOrigin: z.string().nullable(),
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

export const authMeResponseSchema = z.object({
  authenticated: z.boolean(),
  user: sessionUserSchema.nullable(),
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
