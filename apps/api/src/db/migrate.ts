import type { Client } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function runMigrations(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const dir = join(__dirname, "migrations");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  } catch {
    return;
  }

  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const existing = await client.execute({
      sql: "SELECT id FROM schema_migrations WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length > 0) continue;
    const sql = await readFile(join(dir, file), "utf8");
    const withoutLineComments = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    const statements = withoutLineComments
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    for (const statement of statements) {
      await client.execute(statement);
    }
    await client.execute({
      sql: "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      args: [id, Date.now()],
    });
  }
}
