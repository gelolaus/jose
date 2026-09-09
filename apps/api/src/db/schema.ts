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
  lastActivityDay: text("last_activity_day"),
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
    .references(() => modules.id, { onDelete: "cascade" }),
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
  objectivesJson: text("objectives_json").notNull().default("[]"),
  instructorReviewStatus: text("instructor_review_status")
    .notNull()
    .default("unreviewed"),
  scaffoldingDefault: text("scaffolding_default").notNull().default("standard"),
  keyVocabularyJson: text("key_vocabulary_json").notNull().default("[]"),
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
  instructorTagsJson: text("instructor_tags_json").notNull().default("[]"),
});

export const lessonContent = sqliteTable("lesson_content", {
  levelId: text("level_id")
    .primaryKey()
    .references(() => levels.id, { onDelete: "cascade" }),
  markdown: text("markdown").notNull(),
  youtubeVideoId: text("youtube_video_id"),
  blocksJson: text("blocks_json"),
  editorialJson: text("editorial_json").notNull().default("{}"),
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
  challengesEnabled: integer("challenges_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
});

export const classMembers = sqliteTable(
  "class_members",
  {
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
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
  /** Teacher-defined title; backfilled for pre-title rows. */
  title: text("title"),
  dueAt: integer("due_at"),
  /** IANA timezone for due display; defaults to Asia/Manila. */
  dueTimezone: text("due_timezone"),
  /** Explicit grading policy: best|latest|override (default best preserves history). */
  gradingPolicy: text("grading_policy").notNull().default("best"),
  /** Immutable snapshot copy for reproducible grading (E). */
  assignedSnapshotJson: text("assigned_snapshot_json"),
  assignedAt: integer("assigned_at").notNull(),
  archivedAt: integer("archived_at"),
});

/** Dedicated manual-grade overrides, separate from attempts (D). */
export const gradeOverrides = sqliteTable(
  "grade_overrides",
  {
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    maxScore: integer("max_score").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.assignmentId, table.learnerId] }),
  }),
);

/** Append-only override history (create/revise/remove). */
export const gradeOverrideAudit = sqliteTable("grade_override_audit", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull(),
  learnerId: text("learner_id").notNull(),
  action: text("action").notNull(),
  score: integer("score"),
  maxScore: integer("max_score"),
  reason: text("reason"),
  actorId: text("actor_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const classChallenges = sqliteTable("class_challenges", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  goalCount: integer("goal_count").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
  closedAt: integer("closed_at"),
});

export const classChallengeTeams = sqliteTable("class_challenge_teams", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => classChallenges.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const classChallengeTeamMembers = sqliteTable(
  "class_challenge_team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => classChallengeTeams.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    assignedAt: integer("assigned_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.learnerId] }),
  }),
);

export const classChallengeParticipants = sqliteTable(
  "class_challenge_participants",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => classChallenges.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    displayMode: text("display_mode").notNull().default("alias"),
    optedInAt: integer("opted_in_at").notNull(),
    withdrawnAt: integer("withdrawn_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.challengeId, table.learnerId] }),
  }),
);

export const classChallengeContributions = sqliteTable("class_challenge_contributions", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => classChallenges.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => classChallengeTeams.id, {
    onDelete: "set null",
  }),
  evidenceKey: text("evidence_key").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  status: text("status").notNull().default("accepted"),
  createdAt: integer("created_at").notNull(),
});

export const inviteAttempts = sqliteTable("invite_attempts", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  inviteCodeHash: text("invite_code_hash").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Path misses recorded for personalized practice — do not gate learning. */
export const learningMisses = sqliteTable("learning_misses", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  levelId: text("level_id")
    .notNull()
    .references(() => levels.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
});

/** Practice attempts never mark path assignments complete. */
export const practiceAttempts = sqliteTable("practice_attempts", {
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

export const practiceReviews = sqliteTable(
  "practice_reviews",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    reviewCount: integer("review_count").notNull().default(0),
    nextDueAt: integer("next_due_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.levelId] }),
  }),
);

/** Monotonic achievements — finishing the course never revokes these. */
export const learnerAchievements = sqliteTable(
  "learner_achievements",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    earnedAt: integer("earned_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.achievementId] }),
  }),
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    levelId: text("level_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.levelId] }),
  }),
);

/** One lesson-time credit per learner and stable lesson id. credit_ms is 0 when already full. */
export const lessonLifeCredits = sqliteTable(
  "lesson_life_credits",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    levelId: text("level_id").notNull(),
    createdAt: integer("created_at").notNull(),
    creditMs: integer("credit_ms").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.levelId] }),
  }),
);

export const roleAudit = sqliteTable("role_audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  targetUserId: text("target_user_id").notNull(),
  priorRole: text("prior_role").notNull(),
  newRole: text("new_role").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const userNameAudit = sqliteTable("user_name_audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  targetUserId: text("target_user_id").notNull(),
  priorName: text("prior_name").notNull(),
  newName: text("new_name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const learnerArtifacts = sqliteTable(
  "learner_artifacts",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    artifactId: text("artifact_id").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    provenance: text("provenance").notNull(),
    body: text("body"),
    imageUrl: text("image_url"),
    journalCoverId: text("journal_cover_id"),
    sourceLevelId: text("source_level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    earnedAt: integer("earned_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.learnerId, table.artifactId] }),
  }),
);
