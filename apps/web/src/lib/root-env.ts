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
