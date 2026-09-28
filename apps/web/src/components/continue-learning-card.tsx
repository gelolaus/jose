"use client";

import type { ContinueLearning, ModuleCard } from "@jose/shared";
import { ArrowRight, BookOpen, Clock3, RotateCcw } from "lucide-react";
import Link from "next/link";
import "./home-mobile.css";

export type DailyGoal = {
  met: boolean;
  completedLevelsToday: number;
  targetLevels: number;
};

export function readDailyGoal(learner: object | null | undefined): DailyGoal | null {
  if (!learner) return null;
  const goal = (learner as { dailyGoal?: DailyGoal }).dailyGoal;
  if (!goal || typeof goal !== "object") return null;
  if (typeof goal.met !== "boolean") return null;
  if (typeof goal.completedLevelsToday !== "number") return null;
  if (typeof goal.targetLevels !== "number") return null;
  return goal;
}

function DailyGoalRing({ goal }: { goal: DailyGoal | null }) {
  if (!goal) return null;
  const status = goal.met ? "Done" : `${goal.completedLevelsToday} of ${goal.targetLevels}`;
  const progress = goal.met
    ? 1
    : goal.targetLevels > 0
      ? Math.min(1, Math.max(0, goal.completedLevelsToday / goal.targetLevels))
      : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="home-daily-goal">
      <svg viewBox="0 0 36 36" className="home-daily-goal__ring" aria-hidden="true">
        <circle className="home-daily-goal__track" cx="18" cy="18" r={radius} />
        <circle
          className="home-daily-goal__progress"
          cx="18"
          cy="18"
          r={radius}
          strokeDasharray={`${progress * circumference} ${circumference}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="home-daily-goal__copy">
        <span className="home-daily-goal__label">Today&apos;s goal</span>
        <span className="home-daily-goal__status">{status}</span>
      </div>
    </div>
  );
}

export function ContinueLearningCard({
  action,
  dailyGoal = null,
}: {
  action: ContinueLearning | null;
  dailyGoal?: DailyGoal | null;
}) {
  if (!action) return null;
  const isReview = action.kind === "review" || action.kind === "explore";
  const Icon = isReview ? RotateCcw : BookOpen;

  return (
    <section
      aria-label="Continue learning"
      className="learn-next home-hero mb-8 flex flex-col gap-5 rounded-3xl border-2 p-5 sm:flex-row sm:items-center sm:p-7"
    >
      <div className="home-hero__body">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--jose-gold)] text-[#1a1a3e] shadow-[0_4px_0_var(--jose-gold-deep)]"
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
          <DailyGoalRing goal={dailyGoal} />
        </div>
      </div>
      <Link href={action.href} className="jose-button home-hero__action shrink-0">
        {isReview ? "Review module" : "Continue learning"}
        <ArrowRight className="size-5" aria-hidden />
      </Link>
    </section>
  );
}

export function StartHereHero({
  module,
  dailyGoal = null,
}: {
  module: ModuleCard;
  dailyGoal?: DailyGoal | null;
}) {
  return (
    <section
      aria-label="Start here"
      className="learn-next home-hero mb-8 flex flex-col gap-5 rounded-3xl border-2 p-5 sm:flex-row sm:items-center sm:p-7"
    >
      <div className="home-hero__body">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--jose-gold)] text-[#1a1a3e] shadow-[0_4px_0_var(--jose-gold-deep)]"
          aria-hidden
        >
          <BookOpen className="size-8" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[var(--jose-accent)]">Start here</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{module.title}</h2>
          <p className="mt-2 text-sm font-semibold text-[var(--jose-text-muted)]">{module.subtitle}</p>
          <DailyGoalRing goal={dailyGoal} />
        </div>
      </div>
      <Link href={`/learn/${module.id}`} className="jose-button home-hero__action shrink-0">
        Start here
        <ArrowRight className="size-5" aria-hidden />
      </Link>
    </section>
  );
}
