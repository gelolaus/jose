"use client";

import {
  downloadJournalExport,
  exportJournalNotes,
  removeJournalEntry,
  searchJournal,
  upsertJournalEntry,
} from "@/lib/journal-store";
import { SEED_CATALOG, SEED_GLOSSARY } from "@/lib/journal-catalog";
import { t } from "@/lib/reading-preferences";
import { useJournalStore } from "@/lib/use-journal-store";
import { useReadingPreferences } from "@/lib/use-reading-preferences";
import type { CatalogEntityKind, JournalEntry } from "@jose/shared";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";

type Tab = "notes" | "glossary" | "books" | "characters" | "places";

export function JournalView() {
  const prefs = useReadingPreferences();
  const { ownerKey, store, ready } = useJournalStore();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("notes");
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("Private reflection");

  const entries = useMemo(
    () => searchJournal(store, query),
    [store, query],
  );

  function onExportPrivate() {
    const data = exportJournalNotes(store, {
      includePrivate: true,
      includeTeacherSubmitted: false,
    });
    downloadJournalExport(data, `jose-private-notes-${Date.now()}.json`);
  }

  function onAddReflection() {
    if (!ownerKey) return;
    const body = draft.trim();
    if (!body) return;
    upsertJournalEntry(ownerKey, {
      kind: "reflection",
      title: draftTitle.trim() || "Private reflection",
      body,
      visibility: "private",
    });
    setDraft("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        items={[
          { href: "/learn", label: t(prefs.locale, "nav.learn") },
          { label: t(prefs.locale, "journal.title") },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
        {t(prefs.locale, "journal.title")}
      </h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Private notes stay on this device until account storage is configured. Teacher-submitted
        reflections are labeled separately and excluded from private exports.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Journal sections">
        {(
          [
            ["notes", "Notes"],
            ["glossary", "Glossary"],
            ["books", "Books"],
            ["characters", "Characters"],
            ["places", "Places"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-extrabold ${
              tab === id
                ? "bg-violet-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "notes" && !ownerKey ? (
        <p className="mt-6 text-sm font-semibold text-slate-600">
          Sign in to keep a private field journal on this device. Notes are stored under your
          account ID, not your display name.
        </p>
      ) : null}

      {tab === "notes" && ownerKey ? (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-sm font-extrabold text-slate-600">
              {t(prefs.locale, "journal.search")}
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
              placeholder="Passage, term, chapter…"
            />
          </label>

          <div className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
            <label className="block text-sm font-extrabold text-slate-600" htmlFor="reflection-title">
              New private reflection
            </label>
            <input
              id="reflection-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-slate-50 px-4 py-2.5 font-bold ring-1 ring-black/10"
            />
            <label className="mt-3 block text-sm font-extrabold text-slate-600" htmlFor="reflection-body">
              Note
            </label>
            <textarea
              id="reflection-body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold ring-1 ring-black/10"
            />
            <button
              type="button"
              onClick={onAddReflection}
              className="mt-3 min-h-11 rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white"
            >
              Save private note
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExportPrivate}
              className="min-h-11 rounded-full bg-violet-100 px-4 py-2 text-sm font-extrabold text-violet-800"
            >
              {t(prefs.locale, "journal.exportPrivate")}
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">
              {t(prefs.locale, "journal.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  locale={prefs.locale}
                  onRemove={() => {
                    if (ownerKey) removeJournalEntry(ownerKey, entry.id);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "glossary" ? <GlossaryPanel /> : null}
      {tab === "books" ? <CatalogPanel kind="book" /> : null}
      {tab === "characters" ? <CatalogPanel kind="character" /> : null}
      {tab === "places" ? <CatalogPanel kind="place" /> : null}
    </div>
  );
}

function JournalEntryCard({
  entry,
  locale,
  onRemove,
}: {
  entry: JournalEntry;
  locale: "en" | "fil";
  onRemove: () => void;
}) {
  const badge =
    entry.visibility === "teacher_submitted"
      ? t(locale, "journal.teacherBadge")
      : t(locale, "journal.privateBadge");
  return (
    <li className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
            {entry.kind} · {badge}
          </p>
          <h2 className="font-display text-xl font-semibold text-slate-800">{entry.title}</h2>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600"
        >
          Remove
        </button>
      </div>
      {entry.body ? (
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">{entry.body}</p>
      ) : null}
      {entry.source ? (
        <Link
          href={entry.source.href}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-violet-700"
        >
          Open source
          {entry.source.levelTitle ? ` · ${entry.source.levelTitle}` : ""}
        </Link>
      ) : null}
    </li>
  );
}

function GlossaryPanel() {
  return (
    <ul className="mt-6 space-y-3">
      {SEED_GLOSSARY.map((term) => (
        <li key={term.id} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
          <h2 className="font-display text-xl font-semibold text-slate-800">{term.term}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{term.definition}</p>
          {term.incomplete ? (
            <p className="mt-2 text-xs font-bold text-amber-700">
              Incomplete: replace with curated glossary copy before production.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CatalogPanel({ kind }: { kind: CatalogEntityKind }) {
  const items = SEED_CATALOG.filter((e) => e.kind === kind);
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
          <h2 className="font-display text-xl font-semibold text-slate-800">{item.name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{item.summary}</p>
          {item.incomplete ? (
            <p className="mt-2 text-xs font-bold text-amber-700">
              Incomplete catalog entry — provide sourced summary and links.
            </p>
          ) : null}
          {item.href ? (
            <Link
              href={item.href}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-violet-700"
            >
              Quick return
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
