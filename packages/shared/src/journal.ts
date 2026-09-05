import { z } from "zod";

/** Visibility for journal notes. Private is the default for student reflections. */
export const journalVisibilitySchema = z.enum(["private", "teacher_submitted"]);
export type JournalVisibility = z.infer<typeof journalVisibilitySchema>;

export const journalEntryKindSchema = z.enum([
  "bookmark",
  "excerpt",
  "term",
  "reflection",
  "artifact",
]);
export type JournalEntryKind = z.infer<typeof journalEntryKindSchema>;

export const journalSourceRefSchema = z.object({
  moduleId: z.string().min(1).max(64),
  levelId: z.string().min(1).max(64).optional(),
  sectionTitle: z.string().max(200).optional(),
  levelTitle: z.string().max(200).optional(),
  href: z.string().min(1).max(500),
});
export type JournalSourceRef = z.infer<typeof journalSourceRefSchema>;

export const journalEntrySchema = z.object({
  id: z.string().min(1).max(64),
  kind: journalEntryKindSchema,
  title: z.string().min(1).max(200),
  body: z.string().max(8000).default(""),
  visibility: journalVisibilitySchema.default("private"),
  source: journalSourceRefSchema.optional(),
  termId: z.string().max(64).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const journalStoreSchema = z.object({
  version: z.literal(1),
  /** Soft owner key until real accounts land; never send private notes to shared demo APIs. */
  ownerKey: z.string().min(1).max(120),
  entries: z.array(journalEntrySchema).max(500),
});
export type JournalStore = z.infer<typeof journalStoreSchema>;

export const glossaryTermSchema = z.object({
  id: z.string().min(1).max(64),
  term: z.string().min(1).max(120),
  definition: z.string().min(1).max(2000),
  /** When true, definition is editorial placeholder pending curated copy. */
  incomplete: z.boolean().default(false),
  relatedHref: z.string().max(500).optional(),
});
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;

export const catalogEntityKindSchema = z.enum(["book", "character", "place"]);
export type CatalogEntityKind = z.infer<typeof catalogEntityKindSchema>;

export const catalogEntitySchema = z.object({
  id: z.string().min(1).max(64),
  kind: catalogEntityKindSchema,
  name: z.string().min(1).max(160),
  summary: z.string().max(1000),
  /** Curated browsing stubs; full encyclopedia content is owner-supplied. */
  incomplete: z.boolean().default(true),
  href: z.string().max(500).optional(),
});
export type CatalogEntity = z.infer<typeof catalogEntitySchema>;

export const journalExportSchema = z.object({
  exportedAt: z.string(),
  ownerKey: z.string(),
  includePrivate: z.boolean(),
  includeTeacherSubmitted: z.boolean(),
  entries: z.array(journalEntrySchema),
});
export type JournalExport = z.infer<typeof journalExportSchema>;
