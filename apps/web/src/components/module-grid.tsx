"use client";

import { ContinueLearningCard } from "@/components/continue-learning-card";
import type { ContinueLearning, ModuleCard } from "@jose/shared";
import { Map, Sparkles, Star } from "lucide-react";
import Link from "next/link";

export function ModuleGrid({
  modules,
  continueLearning,
}: {
  modules: ModuleCard[];
  continueLearning: ContinueLearning | null;
}) {
  if (modules.length === 0) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-[var(--jose-ink)]">
          Nothing published yet
        </p>
        <p className="text-base text-[var(--jose-ink-muted)]">
          A teacher needs to publish a module first.
        </p>
      </div>
    );
  }

  return (
    <div className="jose-surface mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <ContinueLearningCard action={continueLearning} />
      <div className="mb-6 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--jose-accent)]">
          Paths
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
          Modules
        </h2>
        <p className="mt-1 text-base text-[var(--jose-ink-muted)]">
          Walk the full life story, or pick a deep dive.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((mod) => (
          <li key={mod.id}>
            <Link
              href={`/learn/${mod.id}`}
              className="block overflow-hidden rounded-2xl text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0.5"
            >
              <div
                className="flex min-h-[11.5rem] flex-col justify-between p-5 sm:min-h-[13rem] sm:p-6"
                style={{ backgroundColor: mod.coverColor }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/95 text-stone-800 shadow-sm">
                    {mod.featured ? (
                      <Star className="size-6" strokeWidth={2.25} aria-hidden />
                    ) : (
                      <Map className="size-6" strokeWidth={2.25} aria-hidden />
                    )}
                  </span>
                  {mod.featured ? (
                    <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-teal-800">
                      The full story
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                      <Sparkles className="size-3.5" strokeWidth={2.25} aria-hidden />
                      Deep dive
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    {mod.title}
                  </p>
                  <p className="mt-1 text-sm text-white/90 sm:text-base">
                    {mod.subtitle}
                  </p>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    {mod.completedCount}/{mod.totalCount} levels
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
