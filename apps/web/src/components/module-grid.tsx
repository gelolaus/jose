"use client";

import { ContinueLearningCard } from "@/components/continue-learning-card";
import type { ContinueLearning, ModuleCard } from "@jose/shared";
import { ArrowRight, Compass, Map, Sparkles, Star, Sun } from "lucide-react";
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
    <div className="jose-surface mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative mb-8 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#0f766e_0%,#0f766e_55%,#0e7490_100%)] px-5 py-6 text-white shadow-[0_16px_36px_rgba(15,118,110,0.2)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-amber-300/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 size-40 rounded-full bg-cyan-200/15 blur-2xl" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold ring-1 ring-white/20">
            <Sun className="size-4 text-amber-200" aria-hidden />
            Welcome back, explorer
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Ready to follow the next clue?
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Learn Rizal&apos;s story one curious step at a time. Pick up where you left off, or wander into a new chapter.
          </p>
          {continueLearning ? (
            <Link
              href={continueLearning.href}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-sm font-extrabold text-amber-950 shadow-[0_4px_0_#b45309] transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 active:shadow-none"
            >
              Continue exploring
              <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
            </Link>
          ) : (
            <Link
              href="/practice"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-sm font-extrabold text-amber-950 shadow-[0_4px_0_#b45309] transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 active:shadow-none"
            >
              Try a quick game
              <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
            </Link>
          )}
        </div>
        <Compass className="pointer-events-none absolute -bottom-7 right-7 size-36 rotate-12 text-white/15 sm:right-16 sm:size-48" strokeWidth={1.2} aria-hidden />
      </section>
      <ContinueLearningCard action={continueLearning} />
      <div className="mb-6 mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--jose-accent)]">
            Your adventure map
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
            Choose a path
          </h2>
          <p className="mt-1 text-base text-[var(--jose-ink-muted)]">
            Walk the full life story, or pick a deep dive.
          </p>
        </div>
        <Link href="/practice" className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-900 transition hover:bg-amber-200">
          Play between lessons <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((mod) => (
          <li key={mod.id}>
            <Link
              href={`/learn/${mod.id}`}
              className="group block overflow-hidden rounded-[1.5rem] text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl active:translate-y-0.5"
            >
              <div
                className="relative flex min-h-[12rem] flex-col justify-between overflow-hidden p-5 sm:min-h-[13rem] sm:p-6"
                style={{ backgroundColor: mod.coverColor }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/95 text-stone-800 shadow-sm transition group-hover:rotate-6 group-hover:scale-105">
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
                  <p className="mt-3 text-sm font-semibold tabular-nums text-white/90">
                    {mod.completedCount}/{mod.totalCount} levels
                  </p>
                  <div className="mt-2 h-1.5 max-w-48 overflow-hidden rounded-full bg-black/15">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${mod.totalCount ? Math.round((mod.completedCount / mod.totalCount) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
