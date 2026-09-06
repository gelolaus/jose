import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureSchema } from "./ensure-schema";
import { createHonestLearner } from "./learners";
import { applyPendingSeeds, SEED_IDS } from "./seed";
import * as schema from "./schema";
import { learnerProgress, learners, levels, modules, seedHistory } from "./schema";
import type { JoseDb } from "./database.service";

type OpenedDb = {
  client: Client;
  db: JoseDb;
  path: string;
  dir: string;
};

function openDisposableDb(label: string): OpenedDb {
  const dir = mkdtempSync(join(tmpdir(), `jose-seed-${label}-`));
  const path = join(dir, "test.sqlite").replace(/\\/g, "/");
  const client = createClient({ url: `file:${path}` });
  const db = drizzle(client, { schema });
  return { client, db, path, dir };
}

async function reopen(path: string, dir: string): Promise<OpenedDb> {
  const client = createClient({ url: `file:${path}` });
  const db = drizzle(client, { schema });
  return { client, db, path, dir };
}

function closeAndRemove(opened: OpenedDb) {
  opened.client.close();
  try {
    rmSync(opened.dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe("explicit versioned seeding", () => {
  it("records seed history and skips re-application", async () => {
    const opened = openDisposableDb("history");
    try {
      await ensureSchema(opened.client);
      const first = await applyPendingSeeds(opened.db, { includeDemo: true });
      expect(first).toEqual([
        { id: SEED_IDS.curriculum, status: "applied" },
        { id: SEED_IDS.gameRelease, status: "applied" },
        { id: SEED_IDS.demoLearner, status: "applied" },
      ]);
      const second = await applyPendingSeeds(opened.db, { includeDemo: true });
      expect(second).toEqual([
        { id: SEED_IDS.curriculum, status: "skipped" },
        { id: SEED_IDS.gameRelease, status: "skipped" },
        { id: SEED_IDS.demoLearner, status: "skipped" },
      ]);
      const history = await opened.db.select().from(seedHistory);
      expect(history.map((row) => row.id).sort()).toEqual(
        [SEED_IDS.curriculum, SEED_IDS.gameRelease, SEED_IDS.demoLearner].sort(),
      );
    } finally {
      closeAndRemove(opened);
    }
  });

  it("does not seed demo learner unless opted in", async () => {
    const opened = openDisposableDb("no-demo");
    try {
      await ensureSchema(opened.client);
      await applyPendingSeeds(opened.db);
      const demo = await opened.db
        .select()
        .from(learners)
        .where(eq(learners.id, "demo-student"));
      expect(demo).toHaveLength(0);
      const mods = await opened.db.select({ id: modules.id }).from(modules);
      expect(mods.some((m) => m.id === "rizal")).toBe(true);
    } finally {
      closeAndRemove(opened);
    }
  });

  it("preserves deletion of a seeded extra and Ateneo after restart + reseed", async () => {
    let opened = openDisposableDb("restart");
    try {
      await ensureSchema(opened.client);
      await applyPendingSeeds(opened.db, { includeDemo: true });

      const beforeExtra = await opened.db
        .select({ id: levels.id })
        .from(levels)
        .where(eq(levels.id, "childhood-timeline"));
      expect(beforeExtra).toHaveLength(1);

      await opened.db
        .delete(learnerProgress)
        .where(eq(learnerProgress.levelId, "childhood-timeline"));
      await opened.client.execute(
        "DELETE FROM game_content WHERE level_id = 'childhood-timeline'",
      );
      await opened.db.delete(levels).where(eq(levels.id, "childhood-timeline"));

      const ateneoLevels = await opened.client.execute(
        `SELECT levels.id FROM levels
         JOIN sections ON sections.id = levels.section_id
         WHERE sections.module_id = 'ateneo-days'`,
      );
      for (const row of ateneoLevels.rows) {
        const levelId = String(row.id ?? row[0]);
        await opened.client.execute({
          sql: "DELETE FROM learner_progress WHERE level_id = ?",
          args: [levelId],
        });
        await opened.client.execute({
          sql: "DELETE FROM attempts WHERE level_id = ?",
          args: [levelId],
        });
        await opened.client.execute({
          sql: "DELETE FROM lesson_content WHERE level_id = ?",
          args: [levelId],
        });
        await opened.client.execute({
          sql: "DELETE FROM game_content WHERE level_id = ?",
          args: [levelId],
        });
        await opened.client.execute({
          sql: "DELETE FROM levels WHERE id = ?",
          args: [levelId],
        });
      }
      await opened.client.execute(
        "DELETE FROM sections WHERE module_id = 'ateneo-days'",
      );
      await opened.db.delete(modules).where(eq(modules.id, "ateneo-days"));

      const { path, dir } = opened;
      opened.client.close();

      opened = await reopen(path, dir);
      await ensureSchema(opened.client);
      const reseed = await applyPendingSeeds(opened.db, { includeDemo: true });
      expect(reseed.every((r) => r.status === "skipped")).toBe(true);

      const afterExtra = await opened.db
        .select({ id: levels.id })
        .from(levels)
        .where(eq(levels.id, "childhood-timeline"));
      expect(afterExtra).toHaveLength(0);
      const afterAteneo = await opened.db
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.id, "ateneo-days"));
      expect(afterAteneo).toHaveLength(0);
    } finally {
      closeAndRemove(opened);
    }
  });

  it("creates production learners with honest statistics", async () => {
    const opened = openDisposableDb("honest");
    try {
      await ensureSchema(opened.client);
      await applyPendingSeeds(opened.db);
      const learner = await createHonestLearner(opened.db, {
        id: "prod-student-1",
        displayName: "Ada",
      });
      expect(learner.xp).toBe(0);
      expect(learner.streak).toBe(0);
      expect(learner.hearts).toBe(5);
      expect(learner.userId).toBeNull();
      const progress = await opened.db
        .select()
        .from(learnerProgress)
        .where(eq(learnerProgress.learnerId, "prod-student-1"));
      expect(progress).toHaveLength(0);
    } finally {
      closeAndRemove(opened);
    }
  });

  it("startup schema ensure alone does not invent curriculum or demo achievements", async () => {
    const opened = openDisposableDb("startup");
    try {
      await ensureSchema(opened.client);
      const mods = await opened.db.select().from(modules);
      const people = await opened.db.select().from(learners);
      const history = await opened.db.select().from(seedHistory);
      expect(mods).toHaveLength(0);
      expect(people).toHaveLength(0);
      expect(history).toHaveLength(0);
    } finally {
      closeAndRemove(opened);
    }
  });
});
