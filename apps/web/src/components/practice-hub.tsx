"use client";

import { GameLabHub } from "@/components/game-lab";
import type { PracticeItem, PracticeReviewResponse } from "@jose/shared";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function PracticeHub({ review }: { review: PracticeReviewResponse }) {
  return (
    <div className="jose-surface mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--jose-accent)]">
          Practice
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
          Personalized review
        </h1>
        <p className="mt-2 text-base text-[var(--jose-ink-muted)]">
          Built from your completed path work, recent mistakes, and transparent
          spacing rules — not opaque AI adaptation.
        </p>
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
          <h2 className="font-display text-2xl font-semibold text-[var(--jose-ink)]">
            Try games
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
