"use client";

import { GameLabHub } from "@/components/game-lab";
import type { PracticeItem, PracticeReviewResponse } from "@jose/shared";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function PracticeHub({ review }: { review: PracticeReviewResponse }) {
  return (
    <div className="jose-surface mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-8 max-w-3xl rounded-[1.75rem] bg-amber-100 px-5 py-6 ring-1 ring-amber-200 sm:px-7 sm:py-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-800">Practice playground</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-amber-950 sm:text-4xl">Keep the curiosity going.</h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-amber-900/80">Review what you&apos;ve seen, then jump into a game when you want a change of pace.</p>
      </div>

      <section className="mb-10">
        <h2 className="font-display text-2xl font-semibold text-[var(--jose-ink)]">
          Your review set
        </h2>
        {review.items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--jose-rule)] bg-white/70 px-4 py-5 text-[var(--jose-ink-muted)]">
            {review.emptyMessage}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {review.items.map((item) => (
              <PracticeCard key={item.id} item={item} />
            ))}
          </ul>
        )}
        <details className="mt-4 rounded-xl border border-[var(--jose-rule)] bg-white/80 px-4 py-3 text-sm text-[var(--jose-ink-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--jose-ink)]">
            Why these activities?
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="border-t border-[var(--jose-rule)] pt-8">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-teal-800" aria-hidden />
          <h2 className="font-display text-2xl font-semibold text-[var(--jose-ink)] sm:text-3xl">
            Choose your next mini-adventure
          </h2>
        </div>
        <p className="mb-4 max-w-2xl text-sm text-[var(--jose-ink-muted)]">
          Sample boards for exploring mechanics. Optional arcade challenge lives
          never change grades or block explanations. Nothing here marks a path
          assignment complete.
        </p>
        <GameLabHub embedded />
      </section>
    </div>
  );
}

function PracticeCard({ item }: { item: PracticeItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex h-full flex-col justify-between rounded-2xl border border-[var(--jose-rule)] bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
            {item.reasonKind.replaceAll("_", " ")}
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-[var(--jose-ink)]">
            {item.title}
          </p>
          <p className="mt-1 text-sm text-[var(--jose-ink-muted)]">
            {item.moduleTitle} · {item.sectionTitle}
          </p>
          <p className="mt-3 text-sm text-stone-600">{item.reason}</p>
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--jose-ink)]">
          Start review
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>
    </li>
  );
}
