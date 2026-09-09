import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadJoseEnv } from "../config/env";
import { isProductionEnv } from "../auth/auth-config";
import { writeLogicalBackup } from "./backup";
import { openDatabaseClient, resolveDatabaseUrl } from "./database.service";
import { runMigrations } from "./migrate";
import { EMPTY_CONFIRM_PHRASE, assertEmptyAllowed, emptyDatabase } from "./empty";

async function main() {
  loadJoseEnv(process.env);
  const confirm =
    process.argv.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length) ?? "";
  const backupOut = process.argv
    .find((a) => a.startsWith("--backup-out="))
    ?.slice("--backup-out=".length);
  if (process.argv.includes("--allow-remote") || process.env.JOSE_ALLOW_EMPTY_REMOTE) {
    console.error(
      "db:empty is local-only; --allow-remote / JOSE_ALLOW_EMPTY_REMOTE are no longer supported. For Turso, create a new empty database and follow docs/ops/empty-start-and-cutover.md.",
    );
    process.exitCode = 1;
    return;
  }
  const allowProduction = process.env.JOSE_ALLOW_EMPTY_PRODUCTION === "true";
  const url = resolveDatabaseUrl();
  if (!process.env.JOSE_DATABASE_URL?.trim()) {
    throw new Error(
      "Refusing to empty: JOSE_DATABASE_URL must be set explicitly (no default).",
    );
  }
  await assertEmptyAllowed({
    databaseUrl: url,
    confirm,
    allowRemote: false,
    isProduction: isProductionEnv(process.env),
    allowProduction,
  });
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length);
    if (p && p !== ":memory:") await mkdir(dirname(p), { recursive: true });
  }
  const client = openDatabaseClient(url);
  try {
    await runMigrations(client);
    const dest =
      backupOut ??
      `data/backups/pre-empty-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await writeLogicalBackup(client, url, dest);
    console.log(`preflight backup: ${dest}`);
    await emptyDatabase(client);
    console.log(
      `emptied ${url} (confirm=${EMPTY_CONFIRM_PHRASE}); migrations re-applied; backup at ${dest}`,
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
