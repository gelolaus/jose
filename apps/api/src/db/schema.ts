import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Learner progress rows. `userId` is null only for the shared demo-student profile;
 * every admitted account gets a learner row whose id equals the user id.
 */
export const learners = sqliteTable("learners", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarId: text("avatar_id").notNull().default("compass"),
  streak: integer("streak").notNull(),
  hearts: integer("hearts").notNull(),
  heartsUpdatedAt: integer("hearts_updated_at").notNull().default(0),
  xp: integer("xp").notNull(),
});

export const modules = sqliteTable("modules", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  coverColor: text("cover_color").notNull(),
  sortOrder: integer("sort_order").notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  /** Null for seeded modules; only admins may edit those. */
  ownerUserId: text("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  revision: integer("revision").notNull().default(0),
  objectives: text("objectives"),
  authorReviewedAt: integer("author_reviewed_at"),
  publishedRevisionId: text("published_revision_id"),
  archivedAt: integer("archived_at"),
  trashedAt: integer("trashed_at"),
  status: text("status"),
});

export const moduleRevisions = sqliteTable("module_revisions", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id),
  revisionNumber: integer("revision_number").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: integer("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  publishedAt: integer("published_at"),
  note: text("note"),
});

export const contentAudit = sqliteTable("content_audit", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  detailJson: text("detail_json"),
  createdAt: integer("created_at").notNull(),
});

/** Explicit per-module edit grants. Owning a module is never implied by role or domain. */
export const moduleCollaborators = sqliteTable(
  "module_collaborators",
  {
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.moduleId, table.userId] }),
  }),
);

export const sections = sqliteTable("sections", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  themeColor: text("theme_color").notNull(),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: integer("archived_at"),
});

export const levels = sqliteTable("levels", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  gameType: text("game_type"),
  sortOrder: integer("sort_order").notNull(),
  revision: integer("revision").notNull().default(0),
  archivedAt: integer("archived_at"),
});

export const lessonContent = sqliteTable("lesson_content", {
  levelId: text("level_id")
    .primaryKey()
    .references(() => levels.id, { onDelete: "cascade" }),
  markdown: text("markdown").notNull(),
  youtubeVideoId: text("youtube_video_id"),
  blocksJson: text("blocks_json"),
});

export const gameContent = sqliteTable("game_content", {
  levelId: text("level_id")
    .primaryKey()
    .references(() => levels.id, { onDelete: "cascade" }),
  json: text("json").notNull(),
});

export const teachAssets = sqliteTable("teach_assets", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  alt: text("alt").notNull(),
  attribution: text("attribution"),
  dataBase64: text("data_base64").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const learnerProgress = sqliteTable(
  "learner_progress",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at").notNull(),
    publishedRevisionId: text("published_revision_id"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.levelId] }),
  }),
);

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  levelId: text("level_id")
    .notNull()
    .references(() => levels.id, { onDelete: "cascade" }),
  contentRevision: text("content_revision").notNull().default(""),
  publishedRevisionId: text("published_revision_id"),
  mode: text("mode").notNull().default("assessment"),
  status: text("status").notNull().default("finished"),
  clientAttemptId: text("client_attempt_id"),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  stars: integer("stars"),
  payload: text("payload"),
  secretJson: text("secret_json"),
  eventsJson: text("events_json"),
  createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"),
});

/** Idempotency receipts for heart-spending miss mutations. */
export const missReceipts = sqliteTable(
  "miss_receipts",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.idempotencyKey] }),
  }),
);

export const seedHistory = sqliteTable("seed_history", {
  id: text("id").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
});

/** Application accounts. Email is admission metadata, never the primary key. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull().default("student"),
  admissionEmail: text("admission_email").notNull(),
  displayName: text("display_name").notNull(),
  suspendedAt: integer("suspended_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Stable Microsoft (or other) provider keys bound to a Jose user. */
export const externalIdentities = sqliteTable("external_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  issuer: text("issuer").notNull(),
  subject: text("subject").notNull(),
  tenantId: text("tenant_id"),
  oid: text("oid"),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
});

/** Short-lived OAuth state + PKCE material (server-side only). */
export const oauthStates = sqliteTable("oauth_states", {
  state: text("state").primaryKey(),
  nonce: text("nonce").notNull(),
  codeVerifier: text("code_verifier").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
});

/** Pending Microsoft identity awaiting APC mailbox verification / admission. */
export const pendingAdmissions = sqliteTable("pending_admissions", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  issuer: text("issuer").notNull(),
  subject: text("subject").notNull(),
  tenantId: text("tenant_id"),
  oid: text("oid"),
  claimedEmail: text("claimed_email"),
  candidateEmail: text("candidate_email"),
  displayName: text("display_name"),
  status: text("status").notNull(),
  denialReason: text("denial_reason"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
});

export const mailboxVerifications = sqliteTable("mailbox_verifications", {
  id: text("id").primaryKey(),
  pendingAdmissionId: text("pending_admission_id")
    .notNull()
    .references(() => pendingAdmissions.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
  lastSentAt: integer("last_sent_at").notNull(),
  consumedAt: integer("consumed_at"),
  createdAt: integer("created_at").notNull(),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teacherId: text("teacher_id").notNull(),
  inviteCodeHash: text("invite_code_hash").notNull(),
  inviteCodeHint: text("invite_code_hint").notNull(),
  inviteFailures: integer("invite_failures").notNull().default(0),
  inviteLockedUntil: integer("invite_locked_until"),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
});

export const classMembers = sqliteTable(
  "class_members",
  {
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id),
    joinedAt: integer("joined_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.classId, table.learnerId] }),
  }),
);

export const assignments = sqliteTable("assignments", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id),
  contentRevisionId: text("content_revision_id")
    .notNull()
    .references(() => moduleRevisions.id),
  dueAt: integer("due_at"),
  assignedAt: integer("assigned_at").notNull(),
  archivedAt: integer("archived_at"),
});

export const inviteAttempts = sqliteTable("invite_attempts", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  inviteCodeHash: text("invite_code_hash").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});
