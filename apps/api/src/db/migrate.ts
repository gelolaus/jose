import type { Client } from "@libsql/client";
import { MIGRATIONS } from "./migrations";

const HISTORY_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`;

export type MigrationResult = {
  id: string;
  status: "applied" | "skipped";
};

export type MigrationConnectionOptions = {
  /** Hosted libSQL manages journal mode and write waiting itself. */
  remoteLibsql?: boolean;
};

/** libsql:// is the hosted connection form used by Turso and remote libSQL. */
export function isRemoteLibsqlUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith("libsql://");
}

export async function configureMigrationConnection(
  client: Client,
  options: MigrationConnectionOptions = {},
): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  if (options.remoteLibsql) return;

  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
}

export async function ensureMigrationHistory(client: Client) {
  await client.execute(HISTORY_TABLE);
}

export async function listAppliedMigrations(client: Client): Promise<string[]> {
  await ensureMigrationHistory(client);
  const result = await client.execute(
    "SELECT id FROM schema_migrations ORDER BY id ASC",
  );
  return result.rows.map((row) => String(row.id ?? row[0]));
}

/**
 * Apply pending versioned migrations. Safe to re-run.
 * Deployments should invoke this as a controlled step (`npm run db:migrate`).
 */
export async function runMigrations(
  client: Client,
  options: MigrationConnectionOptions = {},
): Promise<MigrationResult[]> {
  await configureMigrationConnection(client, options);
  await ensureMigrationHistory(client);
  const applied = new Set(await listAppliedMigrations(client));
  const results: MigrationResult[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      results.push({ id: migration.id, status: "skipped" });
      continue;
    }
    await migration.up(client);
    await client.execute({
      sql: "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      args: [migration.id, Date.now()],
    });
    results.push({ id: migration.id, status: "applied" });
  }
  return results;
}

export async function assertMigrationsApplied(client: Client): Promise<void> {
  const applied = new Set(await listAppliedMigrations(client));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id)).map((m) => m.id);
  if (pending.length > 0) {
    throw new Error(
      `Pending database migrations: ${pending.join(", ")}. Run: npm run db:migrate`,
    );
  }
}

/** @deprecated Prefer runMigrations — kept as a thin alias for call-site clarity. */
export async function ensureSchema(client: Client) {
  await runMigrations(client);
}
