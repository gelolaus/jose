import { z } from "zod";

export const uiLocaleSchema = z.enum(["en", "fil"]);
export type UiLocale = z.infer<typeof uiLocaleSchema>;

export const textSizeSchema = z.enum(["md", "lg", "xl"]);
export type TextSize = z.infer<typeof textSizeSchema>;

export const readingPreferencesSchema = z.object({
  version: z.literal(1),
  locale: uiLocaleSchema.default("en"),
  textSize: textSizeSchema.default("md"),
  /** Explicit user preference; when null, CSS prefers-reduced-motion wins. */
  reduceMotion: z.boolean().nullable().default(null),
  soundEnabled: z.boolean().default(false),
  /** Narration requires licensed audio assets — stays unavailable until provided. */
  narrationEnabled: z.boolean().default(false),
});
export type ReadingPreferences = z.infer<typeof readingPreferencesSchema>;

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  version: 1,
  locale: "en",
  textSize: "md",
  reduceMotion: null,
  soundEnabled: false,
  narrationEnabled: false,
};
