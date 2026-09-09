import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "./migrate";
import { EMPTY_CONFIRM_PHRASE, assertEmptyAllowed, emptyDatabase } from "./empty";
import * as schema from "./schema";
import { learners } from "./schema";

function openTmp() {
  const dir = mkdtempSync(join(tmpdir(), "jose-empty-"));
  const path = join(dir, "t.sqlite").replace(/\\/g, "/");
  const url = `file:${path}`;
  const client = createClient({ url });
  return { client, db: drizzle(client, { schema }), url, dir };
}

describe("guarded empty", () => {
  it("requires the exact confirmation phrase", async () => {
    const opened = openTmp();
    try {
      await expect(
        assertEmptyAllowed({
          databaseUrl: opened.url,
          confirm: "yes",
          allowRemote: false,
          isProduction: false,
        }),
      ).rejects.toThrow(/EMPTY-JOSE-DATABASE/);
    } finally {
      opened.client.close();
    }
  });

  it("refuses remote libsql without explicit allow", async () => {
    await expect(
      assertEmptyAllowed({
        databaseUrl: "libsql://demo.turso.io",
        confirm: EMPTY_CONFIRM_PHRASE,
        allowRemote: false,
        isProduction: false,
      }),
    ).rejects.toThrow(/remote/i);
  });

  it("is local-only: refuses remote even with allowRemote true", async () => {
    await expect(
      assertEmptyAllowed({
        databaseUrl: "libsql://demo.turso.io",
        confirm: EMPTY_CONFIRM_PHRASE,
        allowRemote: true,
        isProduction: false,
      }),
    ).rejects.toThrow(/local-only|remote/i);
    await expect(
      assertEmptyAllowed({
        databaseUrl: "https://demo.turso.io",
        confirm: EMPTY_CONFIRM_PHRASE,
        allowRemote: true,
        isProduction: false,
      }),
    ).rejects.toThrow(/local-only|remote/i);
  });

  it("rolls back when a delete fails (atomic)", async () => {
    const opened = openTmp();
    try {
      await runMigrations(opened.client);
      await opened.db.insert(learners).values({
        id: "atomic-keep",
        displayName: "Atomic",
        streak: 0,
        hearts: 5,
        heartsUpdatedAt: 0,
        xp: 0,
      });
      // Fault injection: fail the second DELETE to prove atomic rollback.
      const original = opened.client.execute.bind(opened.client);
      let calls = 0;
      (opened.client as unknown as { execute: typeof original }).execute = (async (
        ...args: Parameters<typeof original>
      ) => {
        const sql = typeof args[0] === "string" ? args[0] : (args[0] as { sql: string }).sql;
        if (typeof sql === "string" && sql.startsWith("DELETE FROM")) {
          calls += 1;
          if (calls === 2) throw new Error("injected delete failure");
        }
        return original(...args);
      }) as typeof original;
      await expect(emptyDatabase(opened.client)).rejects.toThrow(/injected/);
      (opened.client as unknown as { execute: typeof original }).execute = original;
      const rows = await opened.db.select().from(learners);
      expect(rows.some((r) => r.id === "atomic-keep")).toBe(true);
    } finally {
      opened.client.close();
    }
  });

  it("empties a file database but preserves migrations", async () => {
    const opened = openTmp();
    try {
      await runMigrations(opened.client);
      await opened.db.insert(learners).values({
        id: "keep-me-not",
        displayName: "Zed",
        streak: 0,
        hearts: 5,
        heartsUpdatedAt: 0,
        xp: 0,
      });
      await assertEmptyAllowed({
        databaseUrl: opened.url,
        confirm: EMPTY_CONFIRM_PHRASE,
        allowRemote: false,
        isProduction: false,
      });
      await emptyDatabase(opened.client);
      const rows = await opened.db.select().from(learners);
      expect(rows).toHaveLength(0);
      const applied = await opened.client.execute("SELECT id FROM schema_migrations");
      expect(applied.rows.length).toBeGreaterThan(0);
    } finally {
      opened.client.close();
    }
  });
});
