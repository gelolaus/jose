"use client";

import type { ContinueLearning } from "@jose/shared";
import { ArrowRight, BookOpen, Clock3, RotateCcw } from "lucide-react";
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
      className="learn-next mb-8 flex flex-col gap-5 rounded-3xl border-2 p-5 sm:flex-row sm:items-center sm:p-7"
    >
      <span
        className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--jose-green)] text-[#234b12] shadow-[0_4px_0_#46a302]"
        aria-hidden
      >
        <Icon className="size-8" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[var(--jose-accent)]">
          {isReview ? "Completed" : "Your next step"}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
          {action.levelTitle}
        </h2>
        <p className="mt-2 text-sm font-semibold text-[var(--jose-text-muted)]">
          {action.moduleTitle} · {action.sectionTitle}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-[var(--jose-text-muted)]">
          <Clock3 className="size-4" aria-hidden /> About{" "}
          {action.approximateMinutes} min
        </p>
        {action.assignmentLabel ? (
          <p className="mt-2 text-sm font-bold">{action.assignmentLabel}</p>
        ) : null}
      </div>
      <Link href={action.href} className="jose-button shrink-0">
        {isReview ? "Review module" : "Continue learning"}
        <ArrowRight className="size-5" aria-hidden />
      </Link>
    </section>
  );
}
