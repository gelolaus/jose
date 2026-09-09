/**
 * Server-only environment validation.
 * Never expose JOSE_DATABASE_AUTH_TOKEN, OAuth secrets, or session secrets via NEXT_PUBLIC_*.
 */
import { isProductionEnv } from "../auth/auth-config";

export type JoseEnv = {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  allowedOrigins: string[];
  /**
   * Express `trust proxy` setting. Rate limits use `req.ip`, which only honors
   * X-Forwarded-For when this is enabled for a known proxy hop count.
   */
  trustProxy: false | number | true;
  maxBodyBytes: number;
  rateLimitWindowMs: number;
  rateLimitLogin: number;
  rateLimitMutation: number;
  rateLimitAttempt: number;
};

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

const FORBIDDEN_PUBLIC_SECRET_NAMES = [
  "NEXT_PUBLIC_JOSE_DATABASE_AUTH_TOKEN",
  "NEXT_PUBLIC_JOSE_DATABASE_URL",
  "NEXT_PUBLIC_JOSE_SESSION_SECRET",
  "NEXT_PUBLIC_JOSE_OAUTH_CLIENT_SECRET",
  "NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET",
];

export function assertNoPublicSecrets(
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const name of FORBIDDEN_PUBLIC_SECRET_NAMES) {
    if (env[name]) {
      throw new EnvValidationError(
        `${name} is set. Database and OAuth secrets must never use NEXT_PUBLIC_*.`,
      );
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    const upper = key.toUpperCase();
    if (
      upper.includes("SECRET") ||
      upper.includes("AUTH_TOKEN") ||
      upper.includes("PRIVATE") ||
      upper.endsWith("_TOKEN")
    ) {
      throw new EnvValidationError(
        `${key} looks like a secret exposed to the client bundle. Use a server-only name.`,
      );
    }
  }
}

function parseNodeEnv(raw: string | undefined): JoseEnv["nodeEnv"] {
  if (raw === "production" || raw === "test" || raw === "development") {
    return raw;
  }
  return "development";
}

function parseOrigins(
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): string[] {
  const raw = env.JOSE_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  const webOrigin = env.JOSE_WEB_ORIGIN?.trim().replace(/\/$/, "");
  if (isProduction) {
    if (!webOrigin) {
      throw new EnvValidationError(
        "JOSE_ALLOWED_ORIGINS or JOSE_WEB_ORIGIN is required in production (https web origin).",
      );
    }
    return [webOrigin];
  }
  const defaults = ["http://localhost:3000", "http://127.0.0.1:3000"];
  if (webOrigin && !defaults.includes(webOrigin)) {
    return [...defaults, webOrigin];
  }
  return defaults;
}

function isRemoteLibsql(url: string): boolean {
  return (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("wss://")
  );
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new EnvValidationError(`${label} must be a positive integer`);
  }
  return value;
}

/**
 * Rate limiting uses Express `req.ip`. That value only reflects X-Forwarded-For
 * when `trust proxy` is set for the reverse-proxy hops in front of the process.
 * Default is false so a client cannot spoof its bucket by sending X-Forwarded-For.
 */
export function parseTrustProxy(
  raw: string | undefined,
): JoseEnv["trustProxy"] {
  if (raw == null || raw.trim() === "") return false;
  const value = raw.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") return false;
  if (value === "true" || value === "yes") return true;
  const hops = Number(raw.trim());
  if (Number.isInteger(hops) && hops >= 1) return hops;
  throw new EnvValidationError(
    "JOSE_TRUST_PROXY must be false, true, or a positive hop count (for example 1).",
  );
}

/**
 * Load and validate Jose API configuration.
 * Production fails closed on missing hosted-DB auth, origins, and public secret leaks.
 */
export function loadJoseEnv(env: NodeJS.ProcessEnv = process.env): JoseEnv {
  assertNoPublicSecrets(env);

  const isProduction = isProductionEnv(env);
  const nodeEnv = isProduction ? "production" : parseNodeEnv(env.NODE_ENV);
  const resolvedUrl = env.JOSE_DATABASE_URL?.trim() ?? "";

  if (isProduction && !resolvedUrl) {
    throw new EnvValidationError(
      "JOSE_DATABASE_URL is required in production (file: path on a persistent volume or libsql://…).",
    );
  }

  const databaseAuthToken = env.JOSE_DATABASE_AUTH_TOKEN?.trim() || undefined;

  if (resolvedUrl && isRemoteLibsql(resolvedUrl) && !databaseAuthToken) {
    throw new EnvValidationError(
      "JOSE_DATABASE_AUTH_TOKEN is required when JOSE_DATABASE_URL points at a hosted libSQL database.",
    );
  }

  const allowedOrigins = parseOrigins(env, isProduction);

  if (isProduction) {
    for (const origin of allowedOrigins) {
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        throw new EnvValidationError(
          `Production JOSE_ALLOWED_ORIGINS / JOSE_WEB_ORIGIN must not include localhost (${origin}).`,
        );
      }
      if (!origin.startsWith("https://") && !origin.startsWith("http://")) {
        throw new EnvValidationError(
          `Invalid origin in JOSE_ALLOWED_ORIGINS: ${origin}`,
        );
      }
    }
  }

  return {
    nodeEnv,
    isProduction,
    port: parsePositiveInt(env.PORT, 3001, "PORT"),
    databaseUrl: resolvedUrl,
    databaseAuthToken,
    allowedOrigins,
    trustProxy: parseTrustProxy(env.JOSE_TRUST_PROXY),
    // Deliberate global limit: must safely carry the documented JMM maximum
    // (200_000 UTF-8 bytes) plus JSON envelope/escaping overhead.
    maxBodyBytes: parsePositiveInt(env.JOSE_MAX_BODY_BYTES, 256 * 1024, "JOSE_MAX_BODY_BYTES"),
    rateLimitWindowMs: parsePositiveInt(
      env.JOSE_RATE_LIMIT_WINDOW_MS,
      60_000,
      "JOSE_RATE_LIMIT_WINDOW_MS",
    ),
    rateLimitLogin: parsePositiveInt(env.JOSE_RATE_LIMIT_LOGIN, 20, "JOSE_RATE_LIMIT_LOGIN"),
    rateLimitMutation: parsePositiveInt(
      env.JOSE_RATE_LIMIT_MUTATION,
      120,
      "JOSE_RATE_LIMIT_MUTATION",
    ),
    rateLimitAttempt: parsePositiveInt(
      env.JOSE_RATE_LIMIT_ATTEMPT,
      60,
      "JOSE_RATE_LIMIT_ATTEMPT",
    ),
  };
}

export function isRemoteDatabaseUrl(url: string): boolean {
  return isRemoteLibsql(url);
}
