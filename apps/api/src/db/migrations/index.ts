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

/** Draft revision counters, lesson blocks, and teacher source assets. */
export const migration005AuthoringStudio: Migration = {
  id: "005_authoring_studio",
  async up(client) {
    await ensureColumn(client, "modules", "revision", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn(client, "levels", "revision", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn(client, "lesson_content", "blocks_json", "TEXT");
    await client.execute(`CREATE TABLE IF NOT EXISTS teach_assets (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      alt TEXT NOT NULL,
      attribution TEXT,
      data_base64 TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_teach_assets_module ON teach_assets (module_id, created_at)`,
    );
  },
};

/** Published snapshots, archive/trash, and classroom tables. Does not create users. */
export const migration006ContentClassroom: Migration = {
  id: "006_content_classroom",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(client, "modules", "objectives", "TEXT");
    await ensureColumn(client, "modules", "author_reviewed_at", "INTEGER");
    await ensureColumn(client, "modules", "published_revision_id", "TEXT");
    await ensureColumn(client, "modules", "archived_at", "INTEGER");
    await ensureColumn(client, "modules", "trashed_at", "INTEGER");
    await ensureColumn(client, "modules", "status", "TEXT");
    await ensureColumn(client, "sections", "archived_at", "INTEGER");
    await ensureColumn(client, "levels", "archived_at", "INTEGER");
    await ensureColumn(client, "learner_progress", "published_revision_id", "TEXT");
    await ensureColumn(client, "attempts", "published_revision_id", "TEXT");
    const statements = [
      `CREATE TABLE IF NOT EXISTS module_revisions (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        revision_number INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        published_at INTEGER,
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS content_audit (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        detail_json TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        invite_code_hash TEXT NOT NULL,
        invite_code_hint TEXT NOT NULL,
        invite_failures INTEGER NOT NULL DEFAULT 0,
        invite_locked_until INTEGER,
        archived_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS class_members (
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        joined_at INTEGER NOT NULL,
        archived_at INTEGER,
        PRIMARY KEY (class_id, learner_id)
      )`,
      `CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        content_revision_id TEXT NOT NULL REFERENCES module_revisions(id) ON DELETE CASCADE,
        due_at INTEGER,
        assigned_at INTEGER NOT NULL,
        archived_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS invite_attempts (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        invite_code_hash TEXT NOT NULL,
        success INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_module_revisions_module
        ON module_revisions (module_id, revision_number)`,
      `CREATE INDEX IF NOT EXISTS idx_content_audit_module
        ON content_audit (module_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_classes_teacher
        ON classes (teacher_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_class
        ON assignments (class_id, assigned_at)`,
    ];
    for (const sql of statements) {
      await client.execute(sql);
    }
  },
};

/** Student experience: editorial metadata, practice, streaks, achievements. */
export const migration007StudentExperience: Migration = {
  id: "007_student_experience",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(client, "learners", "last_activity_day", "TEXT");
    await ensureColumn(client, "sections", "objectives_json", "TEXT NOT NULL DEFAULT '[]'");
    await ensureColumn(
      client,
      "sections",
      "instructor_review_status",
      "TEXT NOT NULL DEFAULT 'unreviewed'",
    );
    await ensureColumn(
      client,
      "sections",
      "scaffolding_default",
      "TEXT NOT NULL DEFAULT 'standard'",
    );
    await ensureColumn(client, "sections", "key_vocabulary_json", "TEXT NOT NULL DEFAULT '[]'");
    await ensureColumn(client, "levels", "instructor_tags_json", "TEXT NOT NULL DEFAULT '[]'");
    await ensureColumn(client, "lesson_content", "editorial_json", "TEXT NOT NULL DEFAULT '{}'");
    const statements = [
      `CREATE TABLE IF NOT EXISTS learning_misses (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS practice_attempts (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        payload TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS practice_reviews (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
        review_count INTEGER NOT NULL DEFAULT 0,
        next_due_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (learner_id, level_id)
      )`,
      `CREATE TABLE IF NOT EXISTS learner_achievements (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        achievement_id TEXT NOT NULL,
        earned_at INTEGER NOT NULL,
        PRIMARY KEY (learner_id, achievement_id)
      )`,
    ];
    for (const sql of statements) {
      await client.execute(sql);
    }
  },
};

/** Journal artifacts awarded from path chests. */
export const migration008LearnerArtifacts: Migration = {
  id: "008_learner_artifacts",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS learner_artifacts (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        artifact_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        provenance TEXT NOT NULL,
        body TEXT,
        image_url TEXT,
        journal_cover_id TEXT,
        source_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
        earned_at INTEGER NOT NULL,
        PRIMARY KEY (learner_id, artifact_id)
      )
    `);
  },
};

/** Optional cooperative class challenges with aliases and async progress. */
export const migration009ClassChallenges: Migration = {
  id: "009_class_challenges",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(
      client,
      "classes",
      "challenges_enabled",
      "INTEGER NOT NULL DEFAULT 0",
    );
    const statements = [
      `CREATE TABLE IF NOT EXISTS class_challenges (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        goal_count INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS class_challenge_teams (
        id TEXT PRIMARY KEY,
        challenge_id TEXT NOT NULL REFERENCES class_challenges(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS class_challenge_team_members (
        team_id TEXT NOT NULL REFERENCES class_challenge_teams(id) ON DELETE CASCADE,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        assigned_at INTEGER NOT NULL,
        PRIMARY KEY (team_id, learner_id)
      )`,
      `CREATE TABLE IF NOT EXISTS class_challenge_participants (
        challenge_id TEXT NOT NULL REFERENCES class_challenges(id) ON DELETE CASCADE,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        alias TEXT NOT NULL,
        display_mode TEXT NOT NULL DEFAULT 'alias',
        opted_in_at INTEGER NOT NULL,
        withdrawn_at INTEGER,
        PRIMARY KEY (challenge_id, learner_id)
      )`,
      `CREATE TABLE IF NOT EXISTS class_challenge_contributions (
        id TEXT PRIMARY KEY,
        challenge_id TEXT NOT NULL REFERENCES class_challenges(id) ON DELETE CASCADE,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        team_id TEXT REFERENCES class_challenge_teams(id) ON DELETE SET NULL,
        evidence_key TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'accepted',
        created_at INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_contribution_unique
        ON class_challenge_contributions (challenge_id, learner_id, evidence_key)`,
      `CREATE INDEX IF NOT EXISTS idx_class_challenges_class
        ON class_challenges (class_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_challenge_contributions_challenge
        ON class_challenge_contributions (challenge_id, created_at)`,
    ];
    for (const sql of statements) {
      await client.execute(sql);
    }
  },
};

/**
 * Server bookmarks, one-time lesson life credits, and teacher-role audit.
 * Existing lesson completions are marked consumed with zero credit so old
 * course replays cannot farm the new 120-second regeneration bonus.
 */
export const migration010BookmarksLivesRoles: Migration = {
  id: "010_bookmarks_lives_roles",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (learner_id, level_id)
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS lesson_life_credits (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        credit_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (learner_id, level_id)
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS role_audit (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        target_user_id TEXT NOT NULL,
        prior_role TEXT NOT NULL,
        new_role TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_bookmarks_learner_created
        ON bookmarks (learner_id, created_at)`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_role_audit_created
        ON role_audit (created_at)`,
    );
    await client.execute(`
      INSERT OR IGNORE INTO lesson_life_credits (learner_id, level_id, created_at, credit_ms)
      SELECT p.learner_id, p.level_id, p.completed_at, 0
      FROM learner_progress p
      INNER JOIN levels l ON l.id = p.level_id
      WHERE l.kind = 'lesson'
    `);
  },
};

export const migration011NameAudit: Migration = {
  id: "011_name_audit",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_name_audit (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        target_user_id TEXT NOT NULL,
        prior_name TEXT NOT NULL,
        new_name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_user_name_audit_created
        ON user_name_audit (created_at)`,
    );
  },
};

/** Gradebook lookups: assignments per class incl. archived, members incl. history, attempts by revision/time. */
export const migration012GradebookIndexes: Migration = {
  id: "012_gradebook_indexes",
  async up(client) {
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_assignments_class_archived ON assignments (class_id, archived_at, assigned_at)`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_class_members_class_archived ON class_members (class_id, archived_at, joined_at)`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_attempts_learner_revision_time ON attempts (learner_id, published_revision_id, created_at) WHERE status = 'finished' AND mode = 'assessment'`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_learner_progress_learner_level ON learner_progress (learner_id, level_id)`,
    );
  },
};

/**
 * Empty-start release marker. Non-destructive: backfills module status for
 * pre-release rows so fresh and upgraded databases agree. Never deletes
 * curriculum, users, learners, attempts, or history. An empty database after
 * this migration means "no modules yet", not "wiped".
 */
export const migration013EmptyStart: Migration = {
  id: "013_empty_start",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(client, "modules", "status", "TEXT");
    await client
      .execute(
        `UPDATE modules SET status = CASE WHEN published = 1 THEN 'published' ELSE 'draft' END WHERE status IS NULL`,
      )
      .catch(() => undefined);
  },
};

/**
 * Assignment titles, due timezones, and explicit grading policy.
 * Migration-safe: adds nullable title/timezone + defaulted policy, then
 * backfills existing rows with a generated label and documented defaults
 * (Asia/Manila, best). Never deletes assignments or attempts.
 */
export const migration014AssignmentDetails: Migration = {
  id: "014_assignment_details",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(client, "assignments", "title", "TEXT");
    await ensureColumn(client, "assignments", "due_timezone", "TEXT");
    await ensureColumn(
      client,
      "assignments",
      "grading_policy",
      "TEXT NOT NULL DEFAULT 'best'",
    );
    await client.execute(
      `UPDATE assignments SET due_timezone = 'Asia/Manila' WHERE due_timezone IS NULL`,
    ).catch(() => undefined);
    await client.execute(
      `UPDATE assignments SET grading_policy = 'best' WHERE grading_policy IS NULL OR grading_policy NOT IN ('best','latest','override')`,
    ).catch(() => undefined);
    // Generated label keeps module title separate: "<module title> · <date>"
    // falls back to Assignment <id prefix> when the module row is missing.
    const rows = await client.execute(
      `SELECT a.id as id, a.assigned_at as assignedAt, m.title as moduleTitle FROM assignments a LEFT JOIN modules m ON m.id = a.module_id WHERE a.title IS NULL`,
    ).catch(() => ({ rows: [] as unknown[] }));
    for (const row of (rows as { rows: Array<Record<string, unknown>> }).rows) {
      const id = String((row as Record<string, unknown>).id ?? "");
      if (!id) continue;
      const moduleTitle = String(
        (row as Record<string, unknown>).moduleTitle ?? "",
      ).trim();
      const assignedAt = Number(
        (row as Record<string, unknown>).assignedAt ?? Date.now(),
      );
      const date = new Date(
        Number.isFinite(assignedAt) ? assignedAt : Date.now(),
      );
      const ymd = Number.isNaN(date.getTime())
        ? "undated"
        : date.toISOString().slice(0, 10);
      const label = `${moduleTitle || "Assignment " + id.slice(0, 8)} · ${ymd}`.slice(
        0,
        80,
      );
      await client.execute({
        sql: `UPDATE assignments SET title = ? WHERE id = ? AND title IS NULL`,
        args: [label, id],
      }).catch(() => undefined);
    }
  },
};

/** Audited manual overrides, separate from attempts. Append-only history. */
export const migration015GradeOverrides: Migration = {
  id: "015_grade_overrides",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`CREATE TABLE IF NOT EXISTS grade_overrides (
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (assignment_id, learner_id)
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS grade_override_audit (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      learner_id TEXT NOT NULL,
      action TEXT NOT NULL,
      score INTEGER,
      max_score INTEGER,
      reason TEXT,
      actor_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_grade_overrides_assignment ON grade_overrides (assignment_id)`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_grade_override_audit_assignment ON grade_override_audit (assignment_id, created_at)`,
    );
  },
};

/**
 * Immutable assigned-revision snapshots for reproducible grading.
 * Copies the assigned moduleRevisions.snapshotJson into the assignment row
 * once; gradebooks prefer this copy so later draft edits, republishes, or
 * seed backfills cannot silently mutate historical grades.
 */
export const migration016AssignedSnapshots: Migration = {
  id: "016_assigned_snapshots",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(
      client,
      "assignments",
      "assigned_snapshot_json",
      "TEXT",
    );
    const rows = await client.execute(
      `SELECT a.id as id, a.assigned_snapshot_json as snap, r.snapshot_json as revSnap FROM assignments a LEFT JOIN module_revisions r ON r.id = a.content_revision_id WHERE a.assigned_snapshot_json IS NULL`,
    ).catch(() => ({ rows: [] as unknown[] }));
    for (const row of (rows as { rows: Array<Record<string, unknown>> }).rows) {
      const id = String((row as Record<string, unknown>).id ?? "");
      const revSnap = (row as Record<string, unknown>).revSnap as
        | string
        | null
        | undefined;
      if (!id || !revSnap) continue;
      await client.execute({
        sql: `UPDATE assignments SET assigned_snapshot_json = ? WHERE id = ? AND assigned_snapshot_json IS NULL`,
        args: [revSnap, id],
      }).catch(() => undefined);
    }
  },
};

export const MIGRATIONS: Migration[] = [
  migration001InitialSchema,
  migration002QueryIndexes,
  migration003IdentityAndAuth,
  migration004AssessmentAttempts,
  migration005AuthoringStudio,
  migration006ContentClassroom,
  migration007StudentExperience,
  migration008LearnerArtifacts,
  migration009ClassChallenges,
  migration010BookmarksLivesRoles,
  migration011NameAudit,
  migration012GradebookIndexes,
  migration013EmptyStart,
  migration014AssignmentDetails,
  migration015GradeOverrides,
  migration016AssignedSnapshots,
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
