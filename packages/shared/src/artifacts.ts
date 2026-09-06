import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const approvalStatusSchema = z.enum(["draft", "approved"]);

export const artifactKindSchema = z.enum([
  "map",
  "excerpt",
  "cover",
  "illustration",
]);

export const journalArtifactSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  kind: artifactKindSchema,
  summary: nonEmpty,
  provenance: nonEmpty,
  body: z.string().trim().max(4000).optional(),
  imageUrl: z.string().trim().url().optional(),
  approvalStatus: approvalStatusSchema.default("draft"),
  teacherInstructions: z.string().trim().max(2000).optional(),
});

export const chestContentSchema = z.object({
  message: nonEmpty,
  artifact: journalArtifactSchema,
  achievementCriteria: nonEmpty,
  journalCoverId: z.string().trim().min(1).nullable().optional(),
});

export const learnerArtifactSchema = z.object({
  artifactId: nonEmpty,
  title: nonEmpty,
  kind: artifactKindSchema,
  summary: nonEmpty,
  provenance: nonEmpty,
  body: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  journalCoverId: z.string().nullable().optional(),
  sourceLevelId: nonEmpty,
  earnedAt: z.number().int().nonnegative(),
});

export const artifactsResponseSchema = z.object({
  artifacts: z.array(learnerArtifactSchema),
  journalCovers: z.array(z.string().min(1)),
});

export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type JournalArtifact = z.infer<typeof journalArtifactSchema>;
export type ChestContent = z.infer<typeof chestContentSchema>;
export type LearnerArtifact = z.infer<typeof learnerArtifactSchema>;
export type ArtifactsResponse = z.infer<typeof artifactsResponseSchema>;

export function emptyChestContent(): ChestContent {
  return {
    message: "A new journal artifact is waiting — replace this draft before publishing.",
    artifact: {
      id: "draft-artifact",
      title: "Draft artifact (replace before publish)",
      kind: "excerpt",
      summary:
        "Placeholder reward. Replace with an approved map, excerpt, cover, or illustration.",
      provenance:
        "Teacher must supply provenance (archive, edition, or public-domain citation).",
      body: "[Paste an instructor-approved excerpt or description here. Do not invent quotations.]",
      approvalStatus: "draft",
      teacherInstructions:
        "Provide: (1) artifact title, (2) kind, (3) short learner-facing summary, (4) provenance citation, (5) optional excerpt/image URL that you have rights to use. Keep approvalStatus as draft until you approve the pack.",
    },
    achievementCriteria: "Complete this path stop once to earn the artifact.",
    journalCoverId: null,
  };
}

export function parseChestContent(raw: unknown): ChestContent {
  return chestContentSchema.parse(raw);
}
