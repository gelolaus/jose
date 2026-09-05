import {
  DEFAULT_AVATAR_ID,
  DEFAULT_DISPLAY_NAME,
  type AvatarId,
} from "@jose/shared";

export const DEV_PROVIDER = "dev";
export const DEV_ISSUER = "jose:dev";
export const MICROSOFT_PROVIDER = "microsoft";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type AuthEnv = {
  demoMode: boolean;
  devLoginEnabled: boolean;
  cookieSecure: boolean;
  cookieSameSite: "lax" | "strict" | "none";
  webOrigins: string[];
  microsoft: MicrosoftAuthConfig | null;
};

export type MicrosoftAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenant: string;
  authority: string;
};

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function loadAuthEnv(): AuthEnv {
  const microsoft = loadMicrosoftConfig();
  return {
    demoMode: envFlag("JOSE_DEMO_MODE", process.env.NODE_ENV !== "production"),
    devLoginEnabled: envFlag("JOSE_DEV_LOGIN", process.env.NODE_ENV !== "production"),
    cookieSecure: envFlag("JOSE_COOKIE_SECURE", false),
    cookieSameSite: parseSameSite(process.env.JOSE_COOKIE_SAMESITE),
    webOrigins: parseOrigins(process.env.JOSE_WEB_ORIGINS),
    microsoft,
  };
}

function parseSameSite(raw: string | undefined): "lax" | "strict" | "none" {
  const value = (raw ?? "lax").toLowerCase();
  if (value === "strict" || value === "none" || value === "lax") return value;
  return "lax";
}

function loadMicrosoftConfig(): MicrosoftAuthConfig | null {
  const clientId = process.env.JOSE_MS_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.JOSE_MS_CLIENT_SECRET?.trim() || "";
  const redirectUri = process.env.JOSE_MS_REDIRECT_URI?.trim() || "";
  const tenant = process.env.JOSE_MS_TENANT?.trim() || "common";

  const anySet = Boolean(clientId || clientSecret || redirectUri || process.env.JOSE_MS_TENANT);
  if (!anySet) return null;

  const missing: string[] = [];
  if (!clientId) missing.push("JOSE_MS_CLIENT_ID");
  if (!clientSecret) missing.push("JOSE_MS_CLIENT_SECRET");
  if (!redirectUri) missing.push("JOSE_MS_REDIRECT_URI");
  if (missing.length > 0) {
    throw new Error(
      `Microsoft auth is partially configured. Set ${missing.join(", ")} or unset all JOSE_MS_* variables to keep it disabled.`,
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    tenant,
    authority: `https://login.microsoftonline.com/${tenant}/v2.0`,
  };
}

export function defaultLearnerProfile(displayName?: string, avatarId?: AvatarId) {
  return {
    displayName: displayName?.trim() || DEFAULT_DISPLAY_NAME,
    avatarId: avatarId ?? DEFAULT_AVATAR_ID,
    streak: 0,
    hearts: 5,
    xp: 0,
  };
}
