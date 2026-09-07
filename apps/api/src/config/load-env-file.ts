import { config } from "dotenv";

/** Loads the API-local environment file while letting the host environment win. */
export function loadApiEnvFile(
  env: NodeJS.ProcessEnv = process.env,
  path = ".env",
): void {
  config({ path, processEnv: env, override: false, quiet: true });
}
