import {
  DEFAULT_READING_PREFERENCES,
  migrateReadingPreferences,
  type ReadingPreferences,
  type UiLocale,
} from "@jose/shared";

export const PREFS_STORAGE_KEY = "jose.reading-prefs.v1";
export const PREFS_CHANGE_EVENT = "jose:prefs-change";

export function parseReadingPreferences(raw: unknown): ReadingPreferences | null {
  try {
    return migrateReadingPreferences(raw);
  } catch {
    return null;
  }
}

export function readReadingPreferences(): ReadingPreferences {
  if (typeof window === "undefined") return DEFAULT_READING_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_READING_PREFERENCES;
    const parsed = JSON.parse(raw) as unknown;
    const prefs = migrateReadingPreferences(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(prefs)) {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }
    return prefs;
  } catch {
    return DEFAULT_READING_PREFERENCES;
  }
}

export function writeReadingPreferences(prefs: ReadingPreferences): void {
  if (typeof window === "undefined") return;
  const next = migrateReadingPreferences(prefs);
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
  applyReadingPreferencesToDocument(next);
}

export function applyReadingPreferencesToDocument(prefs: ReadingPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = "en";
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
  | "prefs.title"
  | "prefs.textSize"
  | "prefs.motion"
  | "prefs.sound"
  | "recovery.unavailable"
  | "recovery.retry"
  | "recovery.support"
  | "recovery.offline";

const EN: Record<UiMessageKey, string> = {
  "nav.learn": "Learn",
  "nav.practice": "Practice",
  "nav.profile": "Profile",
  "nav.journal": "Bookmarks",
  "skip.toContent": "Skip to main content",
  "journal.title": "Bookmarks",
  "journal.search": "Search lessons",
  "journal.empty": "Save a lesson to find it here.",
  "prefs.title": "Reading settings",
  "prefs.textSize": "Text size",
  "prefs.motion": "Reduce motion",
  "prefs.sound": "Sound effects",
  "recovery.unavailable": "This page could not be loaded right now.",
  "recovery.retry": "Try again",
  "recovery.support": "Contact support",
  "recovery.offline": "You appear to be offline. Reconnect, then retry.",
};

export function t(_locale: UiLocale, key: UiMessageKey): string {
  return EN[key];
}
