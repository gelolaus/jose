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
  instructorTagsJson: text("instructor_tags_json").notNull().default("[]"),
});

export const lessonContent = sqliteTable("lesson_content", {
  levelId: text("level_id")
    .primaryKey()
    .references(() => levels.id, { onDelete: "cascade" }),
  markdown: text("markdown").notNull(),
  youtubeVideoId: text("youtube_video_id"),
  editorialJson: text("editorial_json").notNull().default("{}"),
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
