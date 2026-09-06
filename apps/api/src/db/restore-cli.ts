import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadJoseEnv } from "../config/env";
import { restoreLogicalBackup } from "./backup";
import { openDatabaseClient, resolveDatabaseUrl } from "./database.service";
import { runMigrations } from "./migrate";

async function main() {
  loadJoseEnv(process.env);
  const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
  const from = fromArg?.slice("--from=".length);
  if (!from) {
    throw new Error("Usage: npm run db:restore -- --from=path/to/backup.json");
  }

  const url = resolveDatabaseUrl();
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (filePath && filePath !== ":memory:") {
      await mkdir(dirname(filePath), { recursive: true });
    }
  }

  const client = openDatabaseClient(url);
  try {
    await runMigrations(client);
    if (from.endsWith(".sqlite")) {
      throw new Error(
        "SQLite file restore: copy the backup file over JOSE_DATABASE_URL (after stopping the API), then run db:migrate. For cross-environment restore use a --json logical backup.",
      );
    }
    const result = await restoreLogicalBackup(client, from);
    console.log("restored tables:", result.restoredTables.join(", "));
    console.log("row counts:", JSON.stringify(result.rowCounts));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
