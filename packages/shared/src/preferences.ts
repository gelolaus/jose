import { z } from "zod";

export const uiLocaleSchema = z.literal("en");
export type UiLocale = z.infer<typeof uiLocaleSchema>;

export const textSizeSchema = z.enum(["md", "lg", "xl"]);
export type TextSize = z.infer<typeof textSizeSchema>;

const readingPreferencesObjectSchema = z.object({
  version: z.literal(1),
  locale: uiLocaleSchema.default("en"),
  textSize: textSizeSchema.default("md"),
  /** Explicit user preference; when null, CSS prefers-reduced-motion wins. */
  reduceMotion: z.boolean().nullable().default(null),
  soundEnabled: z.boolean().default(false),
  /** Narration requires licensed audio assets — stays unavailable until provided. */
  narrationEnabled: z.literal(false).default(false),
});

export const readingPreferencesSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  return {
    version: 1,
    locale: "en",
    textSize: obj.textSize,
    reduceMotion: obj.reduceMotion === undefined ? null : obj.reduceMotion,
    soundEnabled: obj.soundEnabled,
    narrationEnabled: false,
  };
}, readingPreferencesObjectSchema);
export type ReadingPreferences = z.infer<typeof readingPreferencesObjectSchema>;

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  version: 1,
  locale: "en",
  textSize: "md",
  reduceMotion: null,
  soundEnabled: false,
  narrationEnabled: false,
};

export function migrateReadingPreferences(raw: unknown): ReadingPreferences {
  const parsed = readingPreferencesSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (!raw || typeof raw !== "object") return DEFAULT_READING_PREFERENCES;
  const obj = raw as Record<string, unknown>;
  const salvage = {
    version: 1 as const,
    locale: "en" as const,
    textSize:
      obj.textSize === "lg" || obj.textSize === "xl" || obj.textSize === "md"
        ? obj.textSize
        : "md",
    reduceMotion:
      obj.reduceMotion === true ? true : obj.reduceMotion === false ? false : null,
    soundEnabled: obj.soundEnabled === true,
    narrationEnabled: false as const,
  };
  return readingPreferencesObjectSchema.parse(salvage);
}
