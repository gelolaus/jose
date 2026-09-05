"use client";

import type { ContinueLearning } from "@jose/shared";
import { ArrowRight, BookOpen, Compass, RotateCcw } from "lucide-react";
import Link from "next/link";

export function ContinueLearningCard({
  action,
}: {
  action: ContinueLearning | null;
}) {
  if (!action) return null;

  const isReview = action.kind === "review" || action.kind === "explore";
  const Icon = isReview ? RotateCcw : BookOpen;

  return (
    <section
      aria-label="Continue learning"
      className="mb-8 overflow-hidden rounded-2xl border border-[var(--jose-rule)] bg-[var(--jose-paper)] shadow-[0_12px_40px_-24px_rgba(28,25,23,0.45)]"
    >
      <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
        <div className="relative p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--jose-ink-soft) 0%, transparent 55%), radial-gradient(circle at 90% 10%, var(--jose-accent-soft), transparent 40%)",
            }}
            aria-hidden
          />
          <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-[var(--jose-accent)]">
            {isReview ? "Keep going" : "Continue learning"}
          </p>
          <h2 className="relative mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
            {action.levelTitle}
          </h2>
          <p className="relative mt-2 max-w-xl text-base leading-relaxed text-[var(--jose-ink-muted)]">
            {action.reason}. {action.moduleTitle}
            {action.sectionTitle ? ` · ${action.sectionTitle}` : ""}.
          </p>
          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--jose-ink)] px-5 py-3 text-sm font-semibold text-[var(--jose-paper)] transition hover:bg-[var(--jose-ink-soft)]"
            >
              <Icon className="size-4" strokeWidth={2.25} aria-hidden />
              {isReview ? "Open practice" : "Resume"}
              <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden />
            </Link>
            {!isReview ? (
              <Link
                href={`/learn/${action.moduleId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--jose-rule)] bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--jose-ink)]"
              >
                <Compass className="size-4" strokeWidth={2.25} aria-hidden />
                View map
              </Link>
            ) : (
              <Link
                href={`/learn/${action.moduleId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--jose-rule)] bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--jose-ink)]"
              >
                Explore modules
              </Link>
            )}
          </div>
        </div>
        <aside className="border-t border-[var(--jose-rule)] bg-[var(--jose-wash)] px-6 py-5 md:border-l md:border-t-0 md:px-7 md:py-8">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--jose-ink-muted)]">
                Chapter
              </dt>
              <dd className="mt-1 font-display text-xl text-[var(--jose-ink)]">
                {action.sectionTitle}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--jose-ink-muted)]">
                About
              </dt>
              <dd className="mt-1 text-[var(--jose-ink)]">
                ~{action.approximateMinutes} min · {action.levelKind}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--jose-ink-muted)]">
                Assignment
              </dt>
              <dd className="mt-1 text-[var(--jose-ink-muted)]">
                {action.assignmentLabel ?? "No class assignment yet"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
