import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations, listAppliedMigrations } from "./migrate";
import {
  backupFileDatabase,
  exportLogicalBackup,
  restoreLogicalBackup,
  writeLogicalBackup,
} from "./backup";
import * as schema from "./schema";
import { attempts, learners } from "./schema";

function open(path: string) {
  const url = `file:${path.replace(/\\/g, "/")}`;
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  return { client, db, url, path };
}

/** Simulate an older DB created before versioned migrations existed. */
async function createLegacyDatabase(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute(`CREATE TABLE learners (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    streak INTEGER NOT NULL,
    hearts INTEGER NOT NULL,
    hearts_updated_at INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL
  )`);
  await client.execute(`CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    cover_color TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE TABLE sections (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    theme_color TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  )`);
  await client.execute(`CREATE TABLE levels (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    game_type TEXT,
    sort_order INTEGER NOT NULL
  )`);
  await client.execute(`CREATE TABLE lesson_content (
    level_id TEXT PRIMARY KEY REFERENCES levels(id) ON DELETE CASCADE,
    markdown TEXT NOT NULL,
    youtube_video_id TEXT
  )`);
  await client.execute(`CREATE TABLE game_content (
    level_id TEXT PRIMARY KEY REFERENCES levels(id) ON DELETE CASCADE,
    json TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE learner_progress (
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    completed_at INTEGER NOT NULL,
    PRIMARY KEY (learner_id, level_id)
  )`);
  await client.execute(`CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL
  )`);
}

describe("migrations and backup/restore", () => {
  let rootDir: string;

  beforeAll(() => {
    rootDir = mkdtempSync(join(tmpdir(), "jose-migrations-"));
  });

  afterAll(async () => {
    await removeFixtureDir(rootDir);
  });

  it("upgrades an older representative database without losing attempts", async () => {
    const dir = mkdtempSync(join(rootDir, "migrate-"));
    const path = join(dir, "legacy.sqlite");
    const { client, db } = open(path);

    await createLegacyDatabase(client);
    await client.execute({
      sql: `INSERT INTO learners (id, display_name, streak, hearts, hearts_updated_at, xp)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["learner-1", "Ana", 2, 3, 1, 40],
    });
    await client.execute({
      sql: `INSERT INTO modules (id, title, subtitle, cover_color, sort_order, published, featured, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["mod-1", "M", "S", "#112233", 0, 1, 1, 1, 1],
    });
    await client.execute({
      sql: `INSERT INTO sections (id, module_id, title, subtitle, theme_color, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["sec-1", "mod-1", "Sec", "sub", "#112233", 0],
    });
    await client.execute({
      sql: `INSERT INTO levels (id, section_id, title, kind, game_type, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["lvl-1", "sec-1", "Quiz", "game", "quiz", 0],
    });
    await client.execute({
      sql: `INSERT INTO attempts (id, learner_id, level_id, score, max_score, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ["attempt-preserve-me", "learner-1", "lvl-1", 8, 10, JSON.stringify({ kept: true }), 123],
    });

    const results = await runMigrations(client);
    expect(results.some((r) => r.status === "applied")).toBe(true);
    const applied = await listAppliedMigrations(client);
    expect(applied).toContain("001_initial_schema");
    expect(applied).toContain("002_query_indexes");
    expect(applied).toContain("003_identity_and_auth");
    expect(applied).toContain("004_assessment_attempts");
    expect(applied).toContain("005_authoring_studio");
    expect(applied).toContain("006_content_classroom");

    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, "attempt-preserve-me"));
    expect(attempt?.score).toBe(8);
    expect(attempt?.payload).toContain("kept");

    const [learner] = await db
      .select()
      .from(learners)
      .where(eq(learners.id, "learner-1"));
    expect(learner?.xp).toBe(40);
    client.close();
  });

  it("restores a logical backup into a fresh environment with integrity", async () => {
    const dir = mkdtempSync(join(rootDir, "backup-"));
    const sourcePath = join(dir, "source.sqlite");
    const restorePath = join(dir, "restore.sqlite");
    const backupJson = join(dir, "backup.json");

    const source = open(sourcePath);
    await runMigrations(source.client);
    await source.db.insert(learners).values({
      id: "learner-restore",
      displayName: "Ben",
      streak: 1,
      hearts: 5,
      heartsUpdatedAt: 9,
      xp: 15,
    });
    await source.client.execute({
      sql: `INSERT INTO modules (id, title, subtitle, cover_color, sort_order, published, featured, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["mod-r", "Restored", "module", "#abcdef", 0, 1, 0, 1, 1],
    });
    await source.client.execute({
      sql: `INSERT INTO sections (id, module_id, title, subtitle, theme_color, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["sec-r", "mod-r", "S", "s", "#abcdef", 0],
    });
    await source.client.execute({
      sql: `INSERT INTO levels (id, section_id, title, kind, game_type, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["lvl-r", "sec-r", "L", "lesson", null, 0],
    });
    await source.client.execute({
      sql: `INSERT INTO learner_progress (learner_id, level_id, completed_at) VALUES (?, ?, ?)`,
      args: ["learner-restore", "lvl-r", 42],
    });
    await source.db.insert(attempts).values({
      id: "att-r",
      learnerId: "learner-restore",
      levelId: "lvl-r",
      score: 1,
      maxScore: 1,
      payload: null,
      createdAt: 42,
    });

    await writeLogicalBackup(source.client, source.url, backupJson);
    const manifest = await exportLogicalBackup(source.client, source.url);
    expect(manifest.tables.attempts?.length).toBe(1);
    source.client.close();

    const target = open(restorePath);
    await runMigrations(target.client);
    const restored = await restoreLogicalBackup(target.client, backupJson);
    expect(restored.rowCounts.learners).toBe(1);
    expect(restored.rowCounts.attempts).toBe(1);
    expect(restored.rowCounts.learner_progress).toBe(1);
    expect(restored.rowCounts.modules).toBe(1);

    const [learner] = await target.db
      .select()
      .from(learners)
      .where(eq(learners.id, "learner-restore"));
    expect(learner?.displayName).toBe("Ben");
    expect(learner?.xp).toBe(15);
    const [attempt] = await target.db.select().from(attempts);
    expect(attempt?.id).toBe("att-r");
    target.client.close();
  });

  it("file backup copies sqlite onto durable path (survives ephemeral restart simulation)", async () => {
    const dir = mkdtempSync(join(rootDir, "filebak-"));
    const livePath = join(dir, "live.sqlite");
    const durablePath = join(dir, "volume", "jose.sqlite");
    const live = open(livePath);
    await runMigrations(live.client);
    await live.db.insert(learners).values({
      id: "persist",
      displayName: "Cara",
      streak: 0,
      hearts: 5,
      heartsUpdatedAt: 0,
      xp: 0,
    });
    live.client.close();

    await backupFileDatabase(`file:${livePath}`, durablePath);
    expect(existsSync(durablePath)).toBe(true);

    const wiped = join(dir, "wiped.sqlite");
    copyFileSync(durablePath, wiped);
    const recovered = open(wiped);
    const rows = await recovered.db.select().from(learners);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("persist");
    recovered.client.close();
  });
});

async function removeFixtureDir(dir: string) {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 });
  } catch {
    // libSQL can retain Windows handles briefly after the Nest application closes.
  }
}
