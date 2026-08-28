"use client";

import { deleteTeachModule, fetchTeachModules, patchTeachModule } from "@/lib/path-api";
import type { TeachModule } from "@jose/shared";
import Link from "next/link";
import { useState } from "react";

export function TeachModuleList({ initial }: { initial: TeachModule[] }) {
  const [modules, setModules] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setModules(await fetchTeachModules());
  }

  async function togglePublish(mod: TeachModule) {
    setBusyId(mod.id);
    try {
      await patchTeachModule(mod.id, { published: !mod.published });
      await reload();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(mod: TeachModule) {
    if (mod.featured) return;
    if (!window.confirm(`Delete “${mod.title}”? This cannot be undone.`)) return;
    setBusyId(mod.id);
    try {
      await deleteTeachModule(mod.id);
      await reload();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error ? <p className="mb-4 text-sm font-bold text-rose-600">{error}</p> : null}
      <ul className="space-y-3">
        {modules.map((mod) => (
          <li
            key={mod.id}
            className="flex flex-col gap-3 rounded-[1.75rem] bg-white p-4 ring-1 ring-black/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-2xl"
                style={{ backgroundColor: mod.coverColor }}
              />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-semibold text-slate-800">
                  {mod.title}
                </p>
                <p className="text-sm font-semibold text-slate-500">
                  {mod.levelCount} levels · {mod.published ? "Published" : "Draft"}
                  {mod.featured ? " · Featured" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/teach/modules/${mod.id}`}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700"
              >
                Edit
              </Link>
              <button
                type="button"
                disabled={busyId === mod.id}
                onClick={() => void togglePublish(mod)}
                className="rounded-full bg-violet-100 px-4 py-2 text-sm font-extrabold text-violet-800 disabled:opacity-50"
              >
                {mod.published ? "Unpublish" : "Publish"}
              </button>
              {mod.featured ? null : (
                <button
                  type="button"
                  disabled={busyId === mod.id}
                  onClick={() => void remove(mod)}
                  className="rounded-full bg-rose-50 px-4 py-2 text-sm font-extrabold text-rose-700 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
