"use client";

import { BookmarkX, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { deleteBookmark, fetchBookmarks } from "@/lib/path-api";
import { migrateLocalBookmarks } from "@/lib/bookmark-migration";
import { useJoseSession } from "@/lib/use-jose-session";
import type { BookmarkItem } from "@jose/shared";

export function BookmarksView() {
  const { authenticated, loading, learner, user } = useJoseSession();
  const accountId = learner?.id ?? user?.id ?? null;
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const data = await fetchBookmarks();
    setItems(data.bookmarks);
  }

  useEffect(() => {
    if (!authenticated || !accountId) return;
    let cancelled = false;
    void (async () => {
      try {
        await migrateLocalBookmarks(accountId);
        if (cancelled) return;
        await reload();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load bookmarks.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, accountId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.title ?? ""} ${item.moduleTitle ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  if (loading) {
    return <p className="px-4 py-10 font-semibold text-slate-600">Loading bookmarks…</p>;
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-3xl font-extrabold">Bookmarks</h1>
        <p className="mt-3 text-[var(--jose-text-muted)]">
          Sign in to save lessons and open them here.
        </p>
        <Link href="/login" className="jose-button mt-6 inline-flex">
          School sign-in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        items={[{ href: "/learn", label: "Learn" }, { label: "Bookmarks" }]}
      />
      <h1 className="font-display text-3xl font-semibold">Bookmarks</h1>
      <label className="mt-4 block">
        <span className="sr-only">Search lessons</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lessons"
          className="min-h-11 w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
        />
      </label>
      {error ? <p className="mt-3 text-sm font-bold text-rose-600">{error}</p> : null}
      {filtered.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="font-semibold text-slate-600">Save a lesson to find it here.</p>
          <Link href="/learn" className="jose-button mt-5 inline-flex">
            Browse lessons
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((item) => (
            <li
              key={item.levelId}
              className="rounded-3xl border border-[var(--jose-rule)] bg-[var(--jose-paper)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold">
                    {item.available ? item.title : "Unavailable lesson"}
                  </p>
                  <p className="text-sm font-semibold text-[var(--jose-text-muted)]">
                    {item.available ? item.moduleTitle : "This lesson is no longer available."}
                  </p>
                  {item.completed ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                      <Check className="size-4" aria-hidden />
                      Completed
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.available && item.href ? (
                    <Link href={item.href} className="jose-button min-h-11 px-4 py-2 text-sm">
                      Open lesson
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === item.levelId}
                    onClick={() => {
                      setBusyId(item.levelId);
                      void deleteBookmark(item.levelId)
                        .then(() => reload())
                        .catch((err) =>
                          setError(err instanceof Error ? err.message : "Could not remove"),
                        )
                        .finally(() => setBusyId(null));
                    }}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700 disabled:opacity-60"
                  >
                    <BookmarkX className="size-4" aria-hidden />
                    Remove bookmark
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
