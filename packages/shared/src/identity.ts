import { z } from "zod";

export const AVATAR_IDS = [
  "compass",
  "sun",
  "book",
  "star",
  "leaf",
  "ship",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR_ID: AvatarId = "compass";
export const DEFAULT_DISPLAY_NAME = "Explorer";

export const avatarIdSchema = z.enum(AVATAR_IDS);

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export function normalizeDisplayName(raw: string): string | null {
  const displayName = raw.trim();
  if (displayName.length < 1 || displayName.length > 20) return null;
  return displayName;
}

export const AUTH_PROVIDERS = ["dev", "microsoft"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const USER_ROLES = ["student", "teacher", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SESSION_COOKIE_NAME = "jose_session";

export const profilePatchBodySchema = z.object({
  displayName: z.string().min(1).max(20).optional(),
  avatarId: avatarIdSchema.optional(),
});

export type ProfilePatchBody = z.infer<typeof profilePatchBodySchema>;

export const authMeResponseSchema = z.object({
  authenticated: z.literal(true),
  userId: z.string().min(1),
  role: z.enum(USER_ROLES),
  learner: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    avatarId: avatarIdSchema,
    streak: z.number().int().nonnegative(),
    hearts: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
  }),
  demoMode: z.boolean(),
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const authAnonymousResponseSchema = z.object({
  authenticated: z.literal(false),
  demoMode: z.boolean(),
  microsoftEnabled: z.boolean(),
  devLoginEnabled: z.boolean(),
});

export type AuthAnonymousResponse = z.infer<typeof authAnonymousResponseSchema>;

export const devLoginBodySchema = z.object({
  externalSubject: z.string().min(1).max(128),
  displayName: z.string().min(1).max(20).optional(),
  avatarId: avatarIdSchema.optional(),
});

export type DevLoginBody = z.infer<typeof devLoginBodySchema>;
