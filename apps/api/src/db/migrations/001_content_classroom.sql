-- Content lifecycle + classroom foundation
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS module_revisions (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  published_at INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS content_audit (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  invite_code_hash TEXT NOT NULL,
  invite_code_hint TEXT NOT NULL,
  invite_failures INTEGER NOT NULL DEFAULT 0,
  invite_locked_until INTEGER,
  archived_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  archived_at INTEGER,
  PRIMARY KEY (class_id, learner_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  content_revision_id TEXT NOT NULL,
  due_at INTEGER,
  assigned_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE TABLE IF NOT EXISTS invite_attempts (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  invite_code_hash TEXT NOT NULL,
  success INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
