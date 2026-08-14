import type { Client } from "@libsql/client";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS learners (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    streak INTEGER NOT NULL,
    hearts INTEGER NOT NULL,
    xp INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    cover_color TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    theme_color TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    game_type TEXT,
    sort_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lesson_content (
    level_id TEXT PRIMARY KEY REFERENCES levels(id) ON DELETE CASCADE,
    markdown TEXT NOT NULL,
    youtube_video_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS game_content (
    level_id TEXT PRIMARY KEY REFERENCES levels(id) ON DELETE CASCADE,
    json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS learner_progress (
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    completed_at INTEGER NOT NULL,
    PRIMARY KEY (learner_id, level_id)
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL
  )`,
];

export async function ensureSchema(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  for (const sql of STATEMENTS) {
    await client.execute(sql);
  }
}
