"use client";

import {
  deleteTeachModule,
  duplicateTeachModule,
  fetchTeachModules,
} from "@/lib/path-api";
import type { TeachModule } from "@jose/shared";
import Link from "next/link";
import { useState } from "react";

export function TeachModuleList({ initial }: { initial: TeachModule[] }) {
  const [modules, setModules] = useState(initial.filter(isActiveModule));
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setModules((await fetchTeachModules()).filter(isActiveModule));
  }

  return (
    <>
      {error ? <p className="mb-4 text-sm font-bold text-rose-600">{error}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {modules.map((mod) => (
          <li
            key={mod.id}
            className="learning-card flex flex-col gap-4 rounded-[1.75rem] p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="size-10 shrink-0 rounded-2xl"
                style={{ backgroundColor: mod.coverColor }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-semibold text-[var(--jose-ink)]">
                  {mod.title}
                </p>
                <p className="text-sm font-semibold text-[var(--jose-ink-muted)]">
                  {mod.published ? "Published" : "Draft"} · {mod.levelCount}{" "}
                  {mod.levelCount === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/teach/modules/${mod.id}`}
                className="jose-button min-h-11 px-4 py-2 text-sm"
              >
                Open
              </Link>
              {mod.featured ? null : (
                <details className="relative">
                  <summary className="jose-button jose-button--secondary flex min-h-11 cursor-pointer list-none items-center px-4 py-2 text-sm">
                    More
                  </summary>
                  <div className="absolute left-0 z-10 mt-2 min-w-48 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/10">
                    <button
                      type="button"
                      disabled={busyId === mod.id}
                      className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-extrabold text-slate-700 disabled:opacity-50"
                      onClick={() => {
                        setBusyId(mod.id);
                        void duplicateTeachModule(mod.id)
                          .then(() => reload())
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : "Duplicate failed"),
                          )
                          .finally(() => setBusyId(null));
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={busyId === mod.id}
                      className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-extrabold text-rose-700 disabled:opacity-50"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete “${mod.title}”? It leaves your module list and you cannot undo that here. Student submissions stay.`,
                          )
                        ) {
                          return;
                        }
                        setBusyId(mod.id);
                        void deleteTeachModule(mod.id)
                          .then(() => reload())
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : "Delete failed"),
                          )
                          .finally(() => setBusyId(null));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function isActiveModule(mod: TeachModule) {
  return !mod.archivedAt && !mod.trashedAt;
}
