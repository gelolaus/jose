import { z } from "zod";

/**
 * Offline lesson packs are optional and practice-only until attempt
 * reconciliation is proven. Assessed attempts must remain online.
 */
export const lessonPackManifestSchema = z.object({
  version: z.literal(1),
  packId: z.string().min(1).max(64),
  moduleId: z.string().min(1).max(64),
  /** Content revision stamp — never overwrite a newer local pack silently. */
  contentRevision: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  downloadedAt: z.number().int().nonnegative(),
  /** Soft account scope; cleared on shared-device logout. */
  ownerKey: z.string().min(1).max(120),
  bytes: z.number().int().nonnegative().optional(),
  practiceOnly: z.literal(true),
  assessedOnlineOnly: z.literal(true),
});
export type LessonPackManifest = z.infer<typeof lessonPackManifestSchema>;

export const lessonPackIndexSchema = z.object({
  version: z.literal(1),
  packs: z.array(lessonPackManifestSchema).max(50),
});
export type LessonPackIndex = z.infer<typeof lessonPackIndexSchema>;

export const bandwidthMeasurementSchema = z.object({
  measuredAt: z.string(),
  deviceLabel: z.string().min(1).max(200),
  networkLabel: z.string().min(1).max(120),
  route: z.string().min(1).max(200),
  /** Milliseconds; null means not yet measured on a representative device. */
  loadMs: z.number().nonnegative().nullable(),
  interactionMs: z.number().nonnegative().nullable(),
  notes: z.string().max(2000).optional(),
  verified: z.boolean(),
});
export type BandwidthMeasurement = z.infer<typeof bandwidthMeasurementSchema>;
