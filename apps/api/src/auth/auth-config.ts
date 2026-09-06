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
  /** Anonymous callers may use the shared demo learner. Never true in production. */
  demoMode: boolean;
  isProduction: boolean;
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

function isTruthy(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV?.trim().toLowerCase() === "production" ||
    env.JOSE_ENV?.trim().toLowerCase() === "production"
  );
}

/**
 * Refuse to boot a production deployment that still carries test-only auth.
 * Every branch here is a way to sign in without a verified APC mailbox.
 */
function assertProductionSafe(env: NodeJS.ProcessEnv, mode: AuthMode) {
  if (!isProductionEnv(env)) return;

  if (mode === "disabled") {
    throw new AuthConfigError(
      "JOSE_AUTH_MODE=disabled cannot run in production. Set JOSE_AUTH_MODE=microsoft.",
    );
  }
  if (mode === "mock") {
    throw new AuthConfigError(
      "JOSE_AUTH_MODE=mock is a test-only login bypass and cannot run in production. Set JOSE_AUTH_MODE=microsoft.",
    );
  }
  if (isTruthy(env.JOSE_AUTH_STUB)) {
    throw new AuthConfigError(
      "JOSE_AUTH_STUB is a test-only identity header and cannot run in production. Remove JOSE_AUTH_STUB.",
    );
  }
  if (isTruthy(env.JOSE_DEMO_MODE)) {
    throw new AuthConfigError(
      "JOSE_DEMO_MODE grants anonymous access to the shared demo learner and cannot run in production. Remove JOSE_DEMO_MODE.",
    );
  }
  if (isTruthy(env.JOSE_AUTH_DEV_LOGIN)) {
    throw new AuthConfigError(
      "JOSE_AUTH_DEV_LOGIN is a test-only login shortcut and cannot run in production. Remove JOSE_AUTH_DEV_LOGIN.",
    );
  }
  if (mode === "microsoft" && env.JOSE_MAIL_TRANSPORT?.trim().toLowerCase() === "memory") {
    throw new AuthConfigError(
      "JOSE_MAIL_TRANSPORT=memory keeps mailbox codes in server memory and would expose them as the only OTP path in production. Configure a real mail transport.",
    );
  }
}

/**
 * Resolve auth configuration.
 * - JOSE_AUTH_MODE=disabled|mock|microsoft (default: disabled)
 * - microsoft mode requires Entra app credentials
 * - mock mode does not call Microsoft; used for local/tests, rejected in production
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
  const isProduction = isProductionEnv(env);

  assertProductionSafe(env, mode);

  // Demo mode is a development affordance; production already rejected it above.
  const demoMode = isTruthy(env.JOSE_DEMO_MODE) && !isProduction;
  const cookieSecure = isProduction
    ? env.JOSE_COOKIE_SECURE?.trim().toLowerCase() !== "false"
    : env.JOSE_COOKIE_SECURE === "true";

  if (mode === "disabled") {
    return {
      mode,
      sessionSecret: env.JOSE_SESSION_SECRET?.trim() || "disabled-no-sessions",
      webOrigin: env.JOSE_WEB_ORIGIN?.trim() || "http://localhost:3000",
      apiPublicUrl: env.JOSE_API_PUBLIC_URL?.trim() || "http://localhost:3001",
      cookieSecure,
      sessionTtlSeconds: 60 * 60 * 24 * 14,
      pendingTtlSeconds: 60 * 30,
      mailboxCodeTtlSeconds: 60 * 15,
      mailboxMaxAttempts: 5,
      mailboxResendCooldownSeconds: 60,
      demoMode,
      isProduction,
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
    cookieSecure,
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
    demoMode,
    isProduction,
    microsoft,
  };
}

export function toAuthStatus(config: AuthRuntimeConfig): AuthStatus {
  return {
    mode: config.mode,
    microsoftConfigured: config.microsoft != null,
    mockEnabled: config.mode === "mock",
    demoMode: config.demoMode,
    allowedDomains: [...APC_ADMISSION_DOMAINS],
    webOrigin: config.webOrigin,
  };
}
