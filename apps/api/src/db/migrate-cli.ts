import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadJoseEnv } from "../config/env";
import { loadApiEnvFile } from "../config/load-env-file";
import { openDatabaseClient, resolveDatabaseUrl } from "./database.service";
import { runMigrations } from "./migrate";

async function main() {
  loadApiEnvFile();
  loadJoseEnv(process.env);
  const url = resolveDatabaseUrl();
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (filePath && filePath !== ":memory:") {
      await mkdir(dirname(filePath), { recursive: true });
    }
  }

  const client = openDatabaseClient(url);
  try {
    const results = await runMigrations(client);
    for (const result of results) {
      console.log(`${result.status}: ${result.id}`);
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
