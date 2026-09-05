import {
  DEFAULT_READING_PREFERENCES,
  readingPreferencesSchema,
  type ReadingPreferences,
  type UiLocale,
} from "@jose/shared";

export const PREFS_STORAGE_KEY = "jose.reading-prefs.v1";
export const PREFS_CHANGE_EVENT = "jose:prefs-change";

export function parseReadingPreferences(raw: unknown): ReadingPreferences | null {
  const parsed = readingPreferencesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function readReadingPreferences(): ReadingPreferences {
  if (typeof window === "undefined") return DEFAULT_READING_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_READING_PREFERENCES;
    return (
      parseReadingPreferences(JSON.parse(raw) as unknown) ??
      DEFAULT_READING_PREFERENCES
    );
  } catch {
    return DEFAULT_READING_PREFERENCES;
  }
}

export function writeReadingPreferences(prefs: ReadingPreferences): void {
  if (typeof window === "undefined") return;
  const next = readingPreferencesSchema.parse(prefs);
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
  applyReadingPreferencesToDocument(next);
}

export function applyReadingPreferencesToDocument(prefs: ReadingPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = prefs.locale === "fil" ? "fil" : "en";
  root.dataset.textSize = prefs.textSize;
  if (prefs.reduceMotion === null) {
    delete root.dataset.reduceMotion;
  } else {
    root.dataset.reduceMotion = prefs.reduceMotion ? "true" : "false";
  }
  root.dataset.soundEnabled = prefs.soundEnabled ? "true" : "false";
}

export function clearReadingPreferencesOnLogout(): void {
  if (typeof window === "undefined") return;
  // Preferences can stay device-local; sound/motion are not private notes.
  // Explicit account-scoped eviction happens when real sessions land.
}

export type UiMessageKey =
  | "nav.learn"
  | "nav.practice"
  | "nav.profile"
  | "nav.journal"
  | "skip.toContent"
  | "journal.title"
  | "journal.search"
  | "journal.empty"
  | "journal.exportPrivate"
  | "journal.privateBadge"
  | "journal.teacherBadge"
  | "prefs.title"
  | "prefs.language"
  | "prefs.textSize"
  | "prefs.motion"
  | "prefs.sound"
  | "prefs.narrationUnavailable"
  | "prefs.contentTranslationPending"
  | "recovery.unavailable"
  | "recovery.retry"
  | "recovery.support"
  | "recovery.offline"
  | "packs.title"
  | "packs.empty"
  | "packs.practiceOnly"
  | "packs.newerRevision";

const EN: Record<UiMessageKey, string> = {
  "nav.learn": "Learn",
  "nav.practice": "Practice",
  "nav.profile": "Profile",
  "nav.journal": "Journal",
  "skip.toContent": "Skip to main content",
  "journal.title": "Field journal",
  "journal.search": "Search bookmarks and notes",
  "journal.empty": "Save a passage or reflection while reading a lesson.",
  "journal.exportPrivate": "Export my private notes",
  "journal.privateBadge": "Private",
  "journal.teacherBadge": "Shared with teacher",
  "prefs.title": "Language & reading",
  "prefs.language": "Interface language",
  "prefs.textSize": "Text size",
  "prefs.motion": "Reduce motion",
  "prefs.sound": "Sound effects",
  "prefs.narrationUnavailable":
    "Narration and transcripts stay off until licensed audio is provided.",
  "prefs.contentTranslationPending":
    "Curated Filipino lesson translations are not loaded yet. Original quotations stay in their source language.",
  "recovery.unavailable": "This page could not be loaded right now.",
  "recovery.retry": "Try again",
  "recovery.support": "Contact support",
  "recovery.offline": "You appear to be offline. Reconnect, then retry.",
  "packs.title": "Downloaded lessons",
  "packs.empty": "No lesson packs on this device.",
  "packs.practiceOnly": "Practice only — assessed attempts need a connection.",
  "packs.newerRevision":
    "A newer content revision is available. Update the pack to keep practicing.",
};

/** Filipino UI chrome strings supplied for product chrome only — not lesson content. */
const FIL: Record<UiMessageKey, string> = {
  "nav.learn": "Mag-aral",
  "nav.practice": "Magsanay",
  "nav.profile": "Profile",
  "nav.journal": "Talaarawan",
  "skip.toContent": "Lumaktaw sa pangunahing nilalaman",
  "journal.title": "Talaarawang pantuklas",
  "journal.search": "Hanapin ang mga bookmark at tala",
  "journal.empty":
    "Mag-save ng sipi o pagninilay habang nagbabasa ng aralin.",
  "journal.exportPrivate": "I-export ang pribadong mga tala",
  "journal.privateBadge": "Pribado",
  "journal.teacherBadge": "Ibinahagi sa guro",
  "prefs.title": "Wika at pagbasa",
  "prefs.language": "Wika ng interface",
  "prefs.textSize": "Laki ng teksto",
  "prefs.motion": "Bawasan ang galaw",
  "prefs.sound": "Mga tunog",
  "prefs.narrationUnavailable":
    "Naka-off ang narration at transcript hanggang may lisensyadong audio.",
  "prefs.contentTranslationPending":
    "Wala pang curated na Filipino na salin ng mga aralin. Nananatili ang orihinal na sipi.",
  "recovery.unavailable": "Hindi ma-load ang pahinang ito ngayon.",
  "recovery.retry": "Subukan muli",
  "recovery.support": "Makipag-ugnayan sa support",
  "recovery.offline": "Mukhang offline ka. Kumonekta ulit, tapos subukan muli.",
  "packs.title": "Mga na-download na aralin",
  "packs.empty": "Walang lesson pack sa device na ito.",
  "packs.practiceOnly":
    "Sanay lang — kailangan ng koneksyon ang assessed attempts.",
  "packs.newerRevision":
    "May mas bagong content revision. I-update ang pack para magpatuloy.",
};

const DICTS: Record<UiLocale, Record<UiMessageKey, string>> = {
  en: EN,
  fil: FIL,
};

export function t(locale: UiLocale, key: UiMessageKey): string {
  return DICTS[locale][key] ?? EN[key];
}
