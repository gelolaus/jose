import type { Client } from "@libsql/client";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'student',
    created_at INTEGER NOT NULL,
    suspended_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS external_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_normalized TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS external_identities_provider_issuer_subject
    ON external_identities(provider, issuer, subject)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS learners (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_id TEXT NOT NULL DEFAULT 'compass',
    streak INTEGER NOT NULL,
    hearts INTEGER NOT NULL,
    hearts_updated_at INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS learners_user_id_unique
    ON learners(user_id) WHERE user_id IS NOT NULL`,
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
  await ensureColumn(client, "learners", "hearts_updated_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(client, "learners", "avatar_id", "TEXT NOT NULL DEFAULT 'compass'");
  await ensureColumn(client, "learners", "user_id", "TEXT");
}

async function ensureColumn(
  client: Client,
  table: string,
  column: string,
  definition: string,
) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const names = info.rows.map((row) => String(row.name ?? row[1] ?? ""));
  if (names.includes(column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
