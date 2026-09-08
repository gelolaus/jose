"use client";

import { ConnectedLocalDevPanel } from "@/components/local-dev-panel";
import { ThemeToggle } from "@/components/presentation-toggle";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  clearLessonPacksForLogout,
  LESSON_PACKS_CHANGE_EVENT,
  readLessonPackIndex,
  registerPracticePackStub,
  removeLessonPack,
  lessonPackStorageKey,
} from "@/lib/lesson-packs";
import { journalOwnerKey } from "@/lib/journal-store";
import { t, writeReadingPreferences } from "@/lib/reading-preferences";
import { useJoseSession } from "@/lib/use-jose-session";
import { useReadingPreferences } from "@/lib/use-reading-preferences";
import type { LessonPackManifest, TextSize, UiLocale } from "@jose/shared";
import { useSyncExternalStore, useState } from "react";

function subscribePacks(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LESSON_PACKS_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LESSON_PACKS_CHANGE_EVENT, onStoreChange);
  };
}

function useLessonPacks(ownerKey: string): LessonPackManifest[] {
  const raw = useSyncExternalStore(
    subscribePacks,
    () =>
      ownerKey
        ? window.localStorage.getItem(lessonPackStorageKey(ownerKey))
        : null,
    () => null,
  );
  void raw;
  return readLessonPackIndex(ownerKey).packs;
}

export function ReadingPreferencesForm() {
  const prefs = useReadingPreferences();
  const { user, learner, localDevAccess } = useJoseSession();
  const accountId = learner?.id ?? user?.id ?? "";
  const ownerKey = accountId ? journalOwnerKey(accountId) : "";
  const packs = useLessonPacks(ownerKey);
  const [packMessage, setPackMessage] = useState<string | null>(null);

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
        Changing language keeps your place in the app. Lesson body translations stay pending until
        you provide curated content.
      </p>

      <div className="mt-6"><p className="mb-2 text-sm font-extrabold">Appearance</p><ThemeToggle /></div>
      {localDevAccess ? <details className="mt-6"><summary className="cursor-pointer text-sm font-bold">Local testing</summary><div className="mt-3"><ConnectedLocalDevPanel compact /></div></details> : null}
      <fieldset className="mt-6 space-y-2">
        <legend className="text-sm font-extrabold text-slate-600">
          {t(prefs.locale, "prefs.language")}
        </legend>
        {(["en", "fil"] as UiLocale[]).map((locale) => (
          <label key={locale} className="flex min-h-11 items-center gap-3 font-bold text-slate-700">
            <input
              type="radio"
              name="locale"
              checked={prefs.locale === locale}
              onChange={() => update("locale", locale)}
            />
            {locale === "en" ? "English" : "Filipino"}
          </label>
        ))}
      </fieldset>
      <p className="mt-2 text-xs font-semibold text-amber-800" role="status">
        {t(prefs.locale, "prefs.contentTranslationPending")}
      </p>

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

      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
        {t(prefs.locale, "prefs.narrationUnavailable")}
      </p>

      <section className="mt-10" aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="font-display text-2xl font-semibold text-slate-800">
          {t(prefs.locale, "packs.title")}
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {t(prefs.locale, "packs.practiceOnly")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-full bg-violet-600 px-4 py-2 text-sm font-extrabold text-white"
            onClick={() => {
              if (!ownerKey) {
                setPackMessage("Sign in to attach practice pack metadata to this account.");
                return;
              }
              const result = registerPracticePackStub({
                ownerKey,
                moduleId: "demo-module",
                title: "Demo practice pack",
                contentRevision: "rev-pending-owner",
              });
              if (!result.ok) {
                setPackMessage(
                  result.reason === "newer_revision"
                    ? t(prefs.locale, "packs.newerRevision")
                    : "Could not save pack metadata.",
                );
              } else {
                setPackMessage(
                  "Saved practice-only pack metadata. Provide CDN/storage URLs before production downloads.",
                );
              }
            }}
          >
            Register practice pack stub
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700"
            onClick={() => {
              if (!ownerKey) {
                setPackMessage("Sign in to clear this account's pack metadata.");
                return;
              }
              clearLessonPacksForLogout(ownerKey);
              setPackMessage("Cleared packs for this account on this device.");
            }}
          >
            Clear packs on logout
          </button>
        </div>
        {packMessage ? (
          <p className="mt-2 text-sm font-semibold text-slate-600" role="status">
            {packMessage}
          </p>
        ) : null}
        {packs.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {t(prefs.locale, "packs.empty")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => (
              <li
                key={pack.packId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10"
              >
                <div>
                  <p className="font-extrabold text-slate-800">{pack.title}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {pack.moduleId} · rev {pack.contentRevision} · practice only
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                  onClick={() => {
                    removeLessonPack(ownerKey, pack.packId);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
