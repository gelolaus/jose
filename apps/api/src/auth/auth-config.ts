import {
  APC_ADMISSION_DOMAINS,
  type AuthMode,
  type AuthStatus,
} from "@jose/shared";

export type AuthRuntimeConfig = {
  mode: AuthMode;
  sessionSecret: string;
  webOrigin: string;
  apiPublicUrl: string;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  pendingTtlSeconds: number;
  mailboxCodeTtlSeconds: number;
  mailboxMaxAttempts: number;
  mailboxResendCooldownSeconds: number;
  microsoft: null | {
    clientId: string;
    clientSecret: string;
    tenant: string;
    redirectUri: string;
    authority: string;
  };
};

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new AuthConfigError(`Missing required environment variable ${name}`);
  }
  return trimmed;
}

function parseNonNegativeInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new AuthConfigError(`${name} must be a non-negative number`);
  }
  return Math.floor(n);
}

/**
 * Resolve auth configuration.
 * - JOSE_AUTH_MODE=disabled|mock|microsoft (default: disabled)
 * - microsoft mode requires Entra app credentials
 * - mock mode does not call Microsoft; used for local/tests
 */
export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthRuntimeConfig {
  const modeRaw = (env.JOSE_AUTH_MODE ?? "disabled").trim().toLowerCase();
  if (modeRaw !== "disabled" && modeRaw !== "mock" && modeRaw !== "microsoft") {
    throw new AuthConfigError(
      `JOSE_AUTH_MODE must be disabled, mock, or microsoft (got ${modeRaw})`,
    );
  }
  const mode = modeRaw as AuthMode;

  if (mode === "disabled") {
    return {
      mode,
      sessionSecret: env.JOSE_SESSION_SECRET?.trim() || "disabled-no-sessions",
      webOrigin: env.JOSE_WEB_ORIGIN?.trim() || "http://localhost:3000",
      apiPublicUrl: env.JOSE_API_PUBLIC_URL?.trim() || "http://localhost:3001",
      cookieSecure: env.JOSE_COOKIE_SECURE === "true",
      sessionTtlSeconds: 60 * 60 * 24 * 14,
      pendingTtlSeconds: 60 * 30,
      mailboxCodeTtlSeconds: 60 * 15,
      mailboxMaxAttempts: 5,
      mailboxResendCooldownSeconds: 60,
      microsoft: null,
    };
  }

  const sessionSecret = required("JOSE_SESSION_SECRET", env.JOSE_SESSION_SECRET);
  if (sessionSecret.length < 32) {
    throw new AuthConfigError("JOSE_SESSION_SECRET must be at least 32 characters");
  }

  const webOrigin = required("JOSE_WEB_ORIGIN", env.JOSE_WEB_ORIGIN).replace(/\/$/, "");
  const apiPublicUrl = required("JOSE_API_PUBLIC_URL", env.JOSE_API_PUBLIC_URL).replace(
    /\/$/,
    "",
  );

  let microsoft: AuthRuntimeConfig["microsoft"] = null;
  if (mode === "microsoft") {
    const clientId = required("JOSE_MICROSOFT_CLIENT_ID", env.JOSE_MICROSOFT_CLIENT_ID);
    const clientSecret = required(
      "JOSE_MICROSOFT_CLIENT_SECRET",
      env.JOSE_MICROSOFT_CLIENT_SECRET,
    );
    const tenant = (env.JOSE_MICROSOFT_TENANT ?? "common").trim() || "common";
    const redirectUri = required(
      "JOSE_MICROSOFT_REDIRECT_URI",
      env.JOSE_MICROSOFT_REDIRECT_URI,
    );
    microsoft = {
      clientId,
      clientSecret,
      tenant,
      redirectUri,
      authority: `https://login.microsoftonline.com/${tenant}/v2.0`,
    };
  }

  return {
    mode,
    sessionSecret,
    webOrigin,
    apiPublicUrl,
    cookieSecure: env.JOSE_COOKIE_SECURE === "true",
    sessionTtlSeconds: parseNonNegativeInt(
      "JOSE_SESSION_TTL_SECONDS",
      env.JOSE_SESSION_TTL_SECONDS,
      60 * 60 * 24 * 14,
    ) || 60 * 60 * 24 * 14,
    pendingTtlSeconds: parseNonNegativeInt(
      "JOSE_PENDING_TTL_SECONDS",
      env.JOSE_PENDING_TTL_SECONDS,
      60 * 30,
    ) || 60 * 30,
    mailboxCodeTtlSeconds: parseNonNegativeInt(
      "JOSE_MAILBOX_CODE_TTL_SECONDS",
      env.JOSE_MAILBOX_CODE_TTL_SECONDS,
      60 * 15,
    ) || 60 * 15,
    mailboxMaxAttempts: parseNonNegativeInt(
      "JOSE_MAILBOX_MAX_ATTEMPTS",
      env.JOSE_MAILBOX_MAX_ATTEMPTS,
      5,
    ) || 5,
    mailboxResendCooldownSeconds: parseNonNegativeInt(
      "JOSE_MAILBOX_RESEND_COOLDOWN_SECONDS",
      env.JOSE_MAILBOX_RESEND_COOLDOWN_SECONDS,
      60,
    ),
    microsoft,
  };
}

export function toAuthStatus(config: AuthRuntimeConfig): AuthStatus {
  return {
    mode: config.mode,
    microsoftConfigured: config.microsoft != null,
    mockEnabled: config.mode === "mock",
    allowedDomains: [...APC_ADMISSION_DOMAINS],
    webOrigin: config.mode === "disabled" ? config.webOrigin : config.webOrigin,
  };
}
