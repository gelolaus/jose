import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";

export type BackupManifest = {
  version: 1;
  createdAt: string;
  sourceUrlKind: "file" | "remote" | "memory";
  tables: Record<string, unknown[]>;
};

/** Parent tables before children so restore can re-enable foreign keys. */
const TABLE_ORDER = [
  "schema_migrations",
  "seed_history",
  "users",
  "learners",
  "modules",
  "module_collaborators",
  "sections",
  "levels",
  "lesson_content",
  "game_content",
  "learner_progress",
  "attempts",
  "miss_receipts",
  "external_identities",
  "sessions",
  "oauth_states",
  "pending_admissions",
  "mailbox_verifications",
] as const;

function urlKind(url: string): BackupManifest["sourceUrlKind"] {
  if (url.includes(":memory:")) return "memory";
  if (url.startsWith("file:")) return "file";
  return "remote";
}

export async function backupFileDatabase(
  databaseUrl: string,
  destinationPath: string,
): Promise<{ mode: "file-copy"; path: string }> {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("backupFileDatabase only supports file: URLs");
  }
  const sourcePath = databaseUrl.slice("file:".length);
  if (!sourcePath || sourcePath === ":memory:") {
    throw new Error("Cannot file-copy an in-memory database");
  }
  await mkdir(dirname(destinationPath), { recursive: true });
  const checkpoint = createClient({ url: databaseUrl });
  try {
    await checkpoint.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    checkpoint.close();
  }
  await copyFile(sourcePath, destinationPath);
  for (const suffix of ["-wal", "-shm"]) {
    try {
      await copyFile(sourcePath + suffix, destinationPath + suffix);
    } catch {
      // ignore missing wal/shm
    }
  }
  return { mode: "file-copy", path: destinationPath };
}

export async function exportLogicalBackup(
  client: Client,
  databaseUrl: string,
): Promise<BackupManifest> {
  const tables: Record<string, unknown[]> = {};
  for (const table of TABLE_ORDER) {
    try {
      const result = await client.execute(`SELECT * FROM ${table}`);
      tables[table] = result.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const column of result.columns) {
          obj[column] = row[column];
        }
        return obj;
      });
    } catch {
      tables[table] = [];
    }
  }
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceUrlKind: urlKind(databaseUrl),
    tables,
  };
}

export async function writeLogicalBackup(
  client: Client,
  databaseUrl: string,
  destinationPath: string,
): Promise<{ mode: "logical-json"; path: string }> {
  const manifest = await exportLogicalBackup(client, databaseUrl);
  await mkdir(dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, JSON.stringify(manifest, null, 2), "utf8");
  return { mode: "logical-json", path: destinationPath };
}

export async function restoreLogicalBackup(
  client: Client,
  backupPath: string,
): Promise<{ restoredTables: string[]; rowCounts: Record<string, number> }> {
  const raw = await readFile(backupPath, "utf8");
  const manifest = JSON.parse(raw) as BackupManifest;
  if (manifest.version !== 1 || !manifest.tables) {
    throw new Error("Unsupported backup manifest");
  }

  await client.execute("PRAGMA foreign_keys = OFF");
  try {
    for (const table of [...TABLE_ORDER].reverse()) {
      await client.execute(`DELETE FROM ${table}`).catch(() => undefined);
    }

    const rowCounts: Record<string, number> = {};
    for (const table of TABLE_ORDER) {
      const rows = manifest.tables[table] ?? [];
      rowCounts[table] = rows.length;
      for (const row of rows) {
        const record = row as Record<string, unknown>;
        const columns = Object.keys(record);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => "?").join(", ");
        await client.execute({
          sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
          args: columns.map((column) => record[column] as string | number | null),
        });
      }
    }
    return { restoredTables: [...TABLE_ORDER], rowCounts };
  } finally {
    await client.execute("PRAGMA foreign_keys = ON");
  }
}

export function defaultBackupPath(kind: "sqlite" | "json" = "sqlite"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext = kind === "json" ? "json" : "sqlite";
  return resolve(process.cwd(), "data", "backups", `jose-${stamp}.${ext}`);
}
