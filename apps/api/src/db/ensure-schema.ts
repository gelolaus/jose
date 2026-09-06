import type { Client } from "@libsql/client";

const STATEMENTS = [
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
  `CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    cover_color TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS module_collaborators (
    module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (module_id, user_id)
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
    content_revision TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT 'assessment',
    status TEXT NOT NULL DEFAULT 'finished',
    client_attempt_id TEXT,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    stars INTEGER,
    payload TEXT,
    secret_json TEXT,
    events_json TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS miss_receipts (
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (learner_id, idempotency_key)
  )`,
  `CREATE TABLE IF NOT EXISTS seed_history (
    id TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'student',
    admission_email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    suspended_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS external_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    tenant_id TEXT,
    oid TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS pending_admissions (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    tenant_id TEXT,
    oid TEXT,
    claimed_email TEXT,
    candidate_email TEXT,
    display_name TEXT,
    status TEXT NOT NULL,
    denial_reason TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS mailbox_verifications (
    id TEXT PRIMARY KEY,
    pending_admission_id TEXT NOT NULL REFERENCES pending_admissions(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_sent_at INTEGER NOT NULL,
    consumed_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
];

export async function ensureSchema(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
  for (const sql of STATEMENTS) {
    await client.execute(sql);
  }
  await ensureColumn(client, "learners", "hearts_updated_at", "INTEGER NOT NULL DEFAULT 0");
  // SQLite only accepts ADD COLUMN with a NULL default, so upgrades add plain columns.
  await ensureColumn(client, "learners", "user_id", "TEXT");
  await ensureColumn(client, "learners", "avatar_id", "TEXT NOT NULL DEFAULT 'compass'");
  await ensureColumn(client, "modules", "owner_user_id", "TEXT");
  await ensureIndex(
    client,
    "external_identities_provider_issuer_subject",
    `CREATE UNIQUE INDEX IF NOT EXISTS external_identities_provider_issuer_subject
      ON external_identities(provider, issuer, subject)`,
  );
  await ensureIndex(
    client,
    "sessions_token_hash",
    `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash ON sessions(token_hash)`,
  );
  await ensureIndex(
    client,
    "users_admission_email",
    `CREATE UNIQUE INDEX IF NOT EXISTS users_admission_email ON users(admission_email)`,
  );
  await ensureIndex(
    client,
    "learners_user_id",
    `CREATE UNIQUE INDEX IF NOT EXISTS learners_user_id ON learners(user_id)
      WHERE user_id IS NOT NULL`,
  );
  await ensureColumn(client, "attempts", "content_revision", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(client, "attempts", "mode", "TEXT NOT NULL DEFAULT 'assessment'");
  await ensureColumn(client, "attempts", "status", "TEXT NOT NULL DEFAULT 'finished'");
  await ensureColumn(client, "attempts", "client_attempt_id", "TEXT");
  await ensureColumn(client, "attempts", "stars", "INTEGER");
  await ensureColumn(client, "attempts", "secret_json", "TEXT");
  await ensureColumn(client, "attempts", "events_json", "TEXT");
  await ensureColumn(client, "attempts", "finished_at", "INTEGER");
  await ensureIndex(
    client,
    "attempts_learner_client_attempt",
    `CREATE UNIQUE INDEX IF NOT EXISTS attempts_learner_client_attempt
      ON attempts(learner_id, client_attempt_id)
      WHERE client_attempt_id IS NOT NULL`,
  );
}

async function ensureIndex(client: Client, _name: string, sql: string) {
  await client.execute(sql);
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
