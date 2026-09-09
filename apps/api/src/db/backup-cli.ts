import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadJoseEnv } from "../config/env";
import { loadApiEnvFile } from "../config/load-env-file";
import {
  backupFileDatabase,
  defaultBackupPath,
  writeLogicalBackup,
} from "./backup";
import { openDatabaseClient, resolveDatabaseUrl } from "./database.service";
import { isRemoteLibsqlUrl, runMigrations } from "./migrate";

async function main() {
  loadApiEnvFile();
  loadJoseEnv(process.env);
  const url = resolveDatabaseUrl();
  const preferJson = process.argv.includes("--json") || !url.startsWith("file:");
  const outArg = process.argv.find((arg) => arg.startsWith("--out="));
  const out = outArg?.slice("--out=".length);

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (filePath && filePath !== ":memory:") {
      await mkdir(dirname(filePath), { recursive: true });
    }
  }

  const client = openDatabaseClient(url);
  try {
    await runMigrations(client, { remoteLibsql: isRemoteLibsqlUrl(url) });
    if (preferJson) {
      const destination = out ?? defaultBackupPath("json");
      const result = await writeLogicalBackup(client, url, destination);
      console.log(`backup ${result.mode}: ${result.path}`);
    } else {
      const destination = out ?? defaultBackupPath("sqlite");
      const result = await backupFileDatabase(url, destination);
      console.log(`backup ${result.mode}: ${result.path}`);
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
