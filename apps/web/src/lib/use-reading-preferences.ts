"use client";

import {
  PREFS_CHANGE_EVENT,
  PREFS_STORAGE_KEY,
  applyReadingPreferencesToDocument,
  parseReadingPreferences,
  readReadingPreferences,
} from "@/lib/reading-preferences";
import { DEFAULT_READING_PREFERENCES, type ReadingPreferences } from "@jose/shared";
import { useEffect, useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFS_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFS_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(PREFS_STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function useReadingPreferences(): ReadingPreferences {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  let prefs = DEFAULT_READING_PREFERENCES;
  if (raw) {
    try {
      prefs =
        parseReadingPreferences(JSON.parse(raw) as unknown) ??
        DEFAULT_READING_PREFERENCES;
    } catch {
      prefs = DEFAULT_READING_PREFERENCES;
    }
  }

  useEffect(() => {
    applyReadingPreferencesToDocument(readReadingPreferences());
  }, [raw]);

  return prefs;
}
