import { config } from "dotenv";
import { resolve } from "node:path";

/** Absolute repository-root local configuration, stable across workspace CWDs. */
export function apiRootEnvPath(): string {
  return resolve(__dirname, "../../../..", ".env");
}

/** Loads root `.env` while letting shell and host environment values win. */
export function loadApiEnvFile(
  env: NodeJS.ProcessEnv = process.env,
  path = apiRootEnvPath(),
): void {
  config({ path, processEnv: env, override: false, quiet: true });
}
