"use client";

import { t } from "@/lib/reading-preferences";
import { useReadingPreferences } from "@/lib/use-reading-preferences";

export function SkipLink() {
  const prefs = useReadingPreferences();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#1a1a3e] focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-white"
    >
      {t(prefs.locale, "skip.toContent")}
    </a>
  );
}
