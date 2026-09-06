"use client";

import { applyReadingPreferencesToDocument, readReadingPreferences } from "@/lib/reading-preferences";
import { useEffect } from "react";

/** Applies persisted reading preferences after hydration without blocking SSR. */
export function PreferencesBoot() {
  useEffect(() => {
    applyReadingPreferencesToDocument(readReadingPreferences());
  }, []);
  return null;
}
