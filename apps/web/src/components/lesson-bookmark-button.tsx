"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteBookmark,
  fetchBookmarks,
  putBookmark,
} from "@/lib/path-api";
import { useJoseSession } from "@/lib/use-jose-session";

export function LessonBookmarkButton({
  levelId,
}: {
  levelId: string;
}) {
  const { authenticated } = useJoseSession();
  const [pressed, setPressed] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void fetchBookmarks()
      .then((data) => {
        if (cancelled) return;
        setPressed(data.bookmarks.some((item) => item.levelId === levelId));
      })
      .catch(() => {
        if (!cancelled) setStatus("Could not load bookmark.");
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, levelId]);

  async function toggle() {
    if (!authenticated) {
      setStatus("Sign in to bookmark this lesson.");
      return;
    }
    if (pending) return;
    const next = !pressed;
    setPressed(next);
    setPending(true);
    setStatus(next ? "Saving…" : "Removing…");
    try {
      if (next) await putBookmark(levelId);
      else await deleteBookmark(levelId);
      setStatus(next ? "Bookmarked." : "Bookmark removed.");
    } catch {
      setPressed(!next);
      setStatus("Could not save bookmark.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={pressed}
        disabled={pending}
        onClick={() => void toggle()}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold ${
          pressed
            ? "bg-[var(--jose-green)] text-[#234b12]"
            : "bg-amber-100 text-amber-900"
        } disabled:opacity-60`}
      >
        <Bookmark className="size-4" strokeWidth={2.4} aria-hidden />
        {pressed ? "Bookmarked" : "Bookmark"}
      </button>
      {status ? (
        <p className="w-full text-sm font-semibold text-slate-600" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
