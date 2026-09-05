import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const learners = sqliteTable("learners", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
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
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sections = sqliteTable("sections", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  themeColor: text("theme_color").notNull(),
  sortOrder: integer("sort_order").notNull(),
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
});

export const lessonContent = sqliteTable("lesson_content", {
  levelId: text("level_id")
    .primaryKey()
    .references(() => levels.id, { onDelete: "cascade" }),
  markdown: text("markdown").notNull(),
  youtubeVideoId: text("youtube_video_id"),
});

export const gameContent = sqliteTable("game_content", {
  levelId: text("level_id")
    .primaryKey()
    .references(() => levels.id, { onDelete: "cascade" }),
  json: text("json").notNull(),
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
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  payload: text("payload"),
  createdAt: integer("created_at").notNull(),
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
