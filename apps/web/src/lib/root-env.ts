import { config } from "dotenv";
import { resolve } from "node:path";

/** Absolute repository-root local configuration, stable across workspace CWDs. */
export function webRootEnvPath(): string {
  return resolve(__dirname, "../../../..", ".env");
}

/** Loads root `.env` while letting Vercel and shell environment values win. */
export function loadRootEnvFile(
  env: NodeJS.ProcessEnv = process.env,
  path = webRootEnvPath(),
): void {
  config({ path, processEnv: env, override: false, quiet: true });
}

/**
 * Keeps Vercel configuration-free for Jose's stable production API domain.
 * Explicit shell values still support local development and future overrides.
 */
export function resolveWebApiOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.JOSE_INTERNAL_API_URL ?? env.NEXT_PUBLIC_API_URL;
  if (explicit?.trim()) return explicit.replace(/\/$/, "");
  return env.NODE_ENV === "production"
    ? "https://api.jose.gelolaus.com"
    : "http://127.0.0.1:3001";
}
