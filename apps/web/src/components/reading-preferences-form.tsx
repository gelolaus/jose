"use client";

import { ThemeToggle } from "@/components/presentation-toggle";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { t, writeReadingPreferences } from "@/lib/reading-preferences";
import { useReadingPreferences } from "@/lib/use-reading-preferences";
import type { TextSize } from "@jose/shared";

export function ReadingPreferencesForm() {
  const prefs = useReadingPreferences();

  function update<K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) {
    writeReadingPreferences({ ...prefs, [key]: value });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        items={[
          { href: "/profile", label: t(prefs.locale, "nav.profile") },
          { label: t(prefs.locale, "prefs.title") },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold text-slate-800">
        {t(prefs.locale, "prefs.title")}
      </h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        These settings stay on this device.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-sm font-extrabold">Appearance</p>
        <ThemeToggle />
      </div>

      <fieldset className="mt-6 space-y-2">
        <legend className="text-sm font-extrabold text-slate-600">
          {t(prefs.locale, "prefs.textSize")}
        </legend>
        {(["md", "lg", "xl"] as TextSize[]).map((size) => (
          <label key={size} className="flex min-h-11 items-center gap-3 font-bold text-slate-700">
            <input
              type="radio"
              name="textSize"
              checked={prefs.textSize === size}
              onChange={() => update("textSize", size)}
            />
            {size === "md" ? "Medium" : size === "lg" ? "Large" : "Extra large"}
          </label>
        ))}
      </fieldset>

      <label className="mt-6 flex min-h-11 items-center gap-3 font-bold text-slate-700">
        <input
          type="checkbox"
          checked={prefs.reduceMotion === true}
          onChange={(e) => update("reduceMotion", e.target.checked ? true : null)}
        />
        {t(prefs.locale, "prefs.motion")}
      </label>

      <label className="mt-3 flex min-h-11 items-center gap-3 font-bold text-slate-700">
        <input
          type="checkbox"
          checked={prefs.soundEnabled}
          onChange={(e) => update("soundEnabled", e.target.checked)}
        />
        {t(prefs.locale, "prefs.sound")}
      </label>
    </div>
  );
}
