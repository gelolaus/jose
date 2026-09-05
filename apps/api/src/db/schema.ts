import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull().default("student"),
  createdAt: integer("created_at").notNull(),
  suspendedAt: integer("suspended_at"),
});

export const externalIdentities = sqliteTable(
  "external_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    emailNormalized: text("email_normalized"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex("external_identities_provider_issuer_subject").on(
      table.provider,
      table.issuer,
      table.subject,
    ),
  }),
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  revokedAt: integer("revoked_at"),
});

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
