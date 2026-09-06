"use client";

import { journalOwnerKey, upsertJournalEntry } from "@/lib/journal-store";
import { useJoseSession } from "@/lib/use-jose-session";
import { useState } from "react";

export function LessonJournalActions({
  moduleId,
  levelId,
  title,
  excerpt,
}: {
  moduleId: string;
  levelId: string;
  title: string;
  excerpt?: string;
}) {
  const { learner, user, authenticated } = useJoseSession();
  const accountId = learner?.id ?? user?.id ?? null;
  const ownerKey = accountId ? journalOwnerKey(accountId) : null;
  const [status, setStatus] = useState<string | null>(null);

  function bookmark() {
    if (!ownerKey || !authenticated) {
      setStatus("Sign in to save a private bookmark to this account.");
      return;
    }
    upsertJournalEntry(ownerKey, {
      kind: "bookmark",
      title: `Bookmark: ${title}`,
      body: excerpt?.slice(0, 500) ?? "",
      visibility: "private",
      source: {
        moduleId,
        levelId,
        levelTitle: title,
        href: `/learn/${moduleId}/${levelId}`,
      },
    });
    setStatus("Saved private bookmark.");
  }

  function saveExcerpt() {
    if (!ownerKey || !authenticated) {
      setStatus("Sign in to save a private excerpt to this account.");
      return;
    }
    const selection =
      typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    const body = (selection || excerpt || "").slice(0, 2000);
    if (!body) {
      setStatus("Select text in the lesson, or open a lesson with content, then try again.");
      return;
    }
    upsertJournalEntry(ownerKey, {
      kind: "excerpt",
      title: `Excerpt: ${title}`,
      body,
      visibility: "private",
      source: {
        moduleId,
        levelId,
        levelTitle: title,
        href: `/learn/${moduleId}/${levelId}`,
      },
    });
    setStatus("Saved private excerpt.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={bookmark}
        className="min-h-11 rounded-full bg-amber-100 px-4 py-2 text-sm font-extrabold text-amber-900"
      >
        Bookmark
      </button>
      <button
        type="button"
        onClick={saveExcerpt}
        className="min-h-11 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700"
      >
        Save excerpt
      </button>
      <a
        href="/journal"
        className="min-h-11 inline-flex items-center rounded-full px-3 py-2 text-sm font-extrabold text-violet-700"
      >
        Open journal
      </a>
      {status ? (
        <p className="w-full text-sm font-semibold text-slate-600" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
