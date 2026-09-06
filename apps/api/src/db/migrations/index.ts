import type { Client } from "@libsql/client";

export type Migration = {
  id: string;
  up: (client: Client) => Promise<void>;
};

/**
 * Initial schema — mirrors tables created before versioned migrations.
 * Safe to apply against an older representative database (IF NOT EXISTS).
 */
export const migration001InitialSchema: Migration = {
  id: "001_initial_schema",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    const statements = [
      `CREATE TABLE IF NOT EXISTS learners (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
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
      `CREATE TABLE IF NOT EXISTS seed_history (
        id TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )`,
    ];
    for (const sql of statements) {
      await client.execute(sql);
    }
    await ensureColumn(
      client,
      "learners",
      "hearts_updated_at",
      "INTEGER NOT NULL DEFAULT 0",
    );
  },
};

/** Indexes for batched catalog / path / progress queries. */
export const migration002QueryIndexes: Migration = {
  id: "002_query_indexes",
  async up(client) {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_sections_module_sort
        ON sections (module_id, sort_order)`,
      `CREATE INDEX IF NOT EXISTS idx_levels_section_sort
        ON levels (section_id, sort_order)`,
      `CREATE INDEX IF NOT EXISTS idx_modules_published_featured
        ON modules (published, featured, sort_order)`,
      `CREATE INDEX IF NOT EXISTS idx_learner_progress_learner
        ON learner_progress (learner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_attempts_learner_level
        ON attempts (learner_id, level_id, created_at)`,
    ];
    for (const sql of indexes) {
      await client.execute(sql);
    }
  },
};

/** Accounts, sessions, Microsoft admission, and teacher ownership. */
export const migration003IdentityAndAuth: Migration = {
  id: "003_identity_and_auth",
  async up(client) {
    const statements = [
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
      `CREATE TABLE IF NOT EXISTS module_collaborators (
        module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (module_id, user_id)
      )`,
    ];
    for (const sql of statements) {
      await client.execute(sql);
    }
    await ensureColumn(client, "learners", "user_id", "TEXT");
    await ensureColumn(client, "learners", "avatar_id", "TEXT NOT NULL DEFAULT 'compass'");
    await ensureColumn(client, "modules", "owner_user_id", "TEXT");
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS external_identities_provider_issuer_subject
        ON external_identities(provider, issuer, subject)`,
    );
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash ON sessions(token_hash)`,
    );
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_admission_email ON users(admission_email)`,
    );
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS learners_user_id ON learners(user_id)
        WHERE user_id IS NOT NULL`,
    );
  },
};

/** Server-scored attempts, miss receipts, and uniqueness for client retries. */
export const migration004AssessmentAttempts: Migration = {
  id: "004_assessment_attempts",
  async up(client) {
    await ensureColumn(client, "attempts", "content_revision", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn(client, "attempts", "mode", "TEXT NOT NULL DEFAULT 'assessment'");
    await ensureColumn(client, "attempts", "status", "TEXT NOT NULL DEFAULT 'finished'");
    await ensureColumn(client, "attempts", "client_attempt_id", "TEXT");
    await ensureColumn(client, "attempts", "stars", "INTEGER");
    await ensureColumn(client, "attempts", "secret_json", "TEXT");
    await ensureColumn(client, "attempts", "events_json", "TEXT");
    await ensureColumn(client, "attempts", "finished_at", "INTEGER");
    await client.execute(`CREATE TABLE IF NOT EXISTS miss_receipts (
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (learner_id, idempotency_key)
    )`);
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS attempts_learner_client_attempt
        ON attempts(learner_id, client_attempt_id)
        WHERE client_attempt_id IS NOT NULL`,
    );
  },
};

export const MIGRATIONS: Migration[] = [
  migration001InitialSchema,
  migration002QueryIndexes,
  migration003IdentityAndAuth,
  migration004AssessmentAttempts,
];

export async function ensureColumn(
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
