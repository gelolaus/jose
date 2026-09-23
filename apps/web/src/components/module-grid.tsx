/* eslint-disable @next/next/no-img-element */
"use client";

import { ContinueLearningCard } from "@/components/continue-learning-card";
import { moduleBookImage } from "@/lib/ui-assets";
import type { ContinueLearning, ModuleCard } from "@jose/shared";
import { ArrowRight, Sparkles } from "lucide-react";
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
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#e8dcc0] text-[#c9a84c]"
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
      <ul className="module-grid">
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
            <li key={mod.id} className="module-wrapper">
              <Link
                href={`/learn/${mod.id}`}
                className="module-cover-link"
                aria-label={`${mod.title}. ${completed ? "Completed" : `${mod.completedCount} of ${mod.totalCount} levels complete`}`}
              >
                <img
                  src={moduleBookImage(index)}
                  alt=""
                  aria-hidden
                  className="book-cover-img"
                />
                <span className="sr-only">{mod.title}</span>
              </Link>
              <div className="module-progress-label">
                <span className="min-w-0 truncate">{mod.title}</span>
                <span>{completed ? "Complete" : `${progress}%`}</span>
              </div>
              <div
                role="progressbar"
                aria-label={`${mod.title} progress`}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="module-progress-track"
              >
                <div
                  className="module-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
