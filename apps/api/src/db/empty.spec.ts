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
