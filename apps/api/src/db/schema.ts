import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  createdAt: integer("created_at").notNull(),
});

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
  ownerId: text("owner_id"),
  objectives: text("objectives"),
  authorReviewedAt: integer("author_reviewed_at"),
  publishedRevisionId: text("published_revision_id"),
  archivedAt: integer("archived_at"),
  trashedAt: integer("trashed_at"),
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
  archivedAt: integer("archived_at"),
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
    levelId: text("level_id").notNull(),
    completedAt: integer("completed_at").notNull(),
    contentRevisionId: text("content_revision_id"),
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
  levelId: text("level_id").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  payload: text("payload"),
  createdAt: integer("created_at").notNull(),
  contentRevisionId: text("content_revision_id"),
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
