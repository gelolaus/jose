"use client";

import { ContinueLearningCard } from "@/components/continue-learning-card";
import type { ContinueLearning, ModuleCard } from "@jose/shared";
import { ArrowRight, BookOpen, Sparkles, Star } from "lucide-react";
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
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-3xl font-extrabold">
          Your next adventure is on its way
        </h1>
        <p className="mt-3 text-[var(--jose-text-muted)]">
          Lessons will appear here when your teacher publishes them.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-7 flex items-center gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff2be] text-[#865600]"
          aria-hidden
        >
          <Sparkles className="size-7" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Let’s make some progress!
          </h1>
          <p className="mt-1 font-semibold text-[var(--jose-text-muted)]">
            A little Rizal, a little discovery, every day.
          </p>
        </div>
      </header>
      <ContinueLearningCard action={continueLearning} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Your learning path</h2>
        <Link
          href="/practice"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[var(--jose-sky)]"
        >
          Practice
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {modules.map((mod, index) => {
          const progress = mod.totalCount
            ? Math.min(
                100,
                Math.round((mod.completedCount / mod.totalCount) * 100),
              )
            : 0;
          const completed =
            mod.totalCount > 0 && mod.completedCount >= mod.totalCount;
          return (
            <li key={mod.id}>
              <Link
                href={`/learn/${mod.id}`}
                className="learning-card group flex h-full flex-col rounded-3xl border-2 p-5 sm:p-6"
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span
                    className={`lesson-icon lesson-icon--${index % 4} flex size-16 items-center justify-center rounded-2xl transition-transform group-hover:-rotate-6`}
                    aria-hidden
                  >
                    {mod.featured ? (
                      <Star className="size-8" strokeWidth={2.5} />
                    ) : (
                      <BookOpen className="size-8" strokeWidth={2.5} />
                    )}
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--jose-text-muted)]">
                    {completed ? "Completed" : mod.featured ? "The full story" : `Module ${index + 1}`}
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold leading-tight">
                  {mod.title}
                </h3>
                <p className="mb-5 mt-2 flex-1 text-sm font-semibold leading-relaxed text-[var(--jose-text-muted)]">
                  {mod.subtitle}
                </p>
                <div className="mb-2 flex items-center justify-between text-sm font-bold">
                  <span className="text-[var(--jose-text-muted)]">
                    {completed
                      ? "Review module"
                      : `${mod.completedCount} / ${mod.totalCount} levels`}
                  </span>
                  <ArrowRight
                    className="size-5 text-[var(--jose-accent)]"
                    aria-hidden
                  />
                </div>
                <div
                  role="progressbar"
                  aria-label={`${mod.title} progress`}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3 overflow-hidden rounded-full bg-[var(--jose-surface-control)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--jose-green)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
