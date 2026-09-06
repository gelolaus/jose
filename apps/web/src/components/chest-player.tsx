"use client";

import { completeLevel } from "@/lib/path-api";
import type { ChestContent } from "@jose/shared";
import { BookOpen, Gift, Map, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const KIND_ICON = {
  map: Map,
  excerpt: ScrollText,
  cover: BookOpen,
  illustration: Gift,
} as const;

export function ChestPlayer({
  levelId,
  moduleId,
  title,
  chest,
  nextLevelId,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  chest: ChestContent;
  nextLevelId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = KIND_ICON[chest.artifact.kind] ?? Gift;

  async function onCollect() {
    setBusy(true);
    setError(null);
    try {
      const result = await completeLevel(levelId);
      setDuplicate(result.artifactAwarded === false);
      setOpened(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save artifact");
    } finally {
      setBusy(false);
    }
  }

  function onContinue() {
    router.push(
      nextLevelId ? `/learn/${moduleId}/${nextLevelId}` : `/learn/${moduleId}`,
    );
    router.refresh();
  }

  if (!opened) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <div className="flex size-28 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-md">
          <Gift className="size-14" strokeWidth={2.2} aria-hidden />
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--jose-ink)]">
          {title}
        </h1>
        <p className="text-lg text-[var(--jose-ink-muted)]">{chest.message}</p>
        <p className="text-sm font-semibold text-[var(--jose-ink-muted)]">
          {chest.achievementCriteria}
        </p>
        {chest.artifact.approvalStatus === "draft" ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 ring-1 ring-amber-200">
            Draft artifact — a teacher should approve provenance before publishing
            this stop.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-semibold text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void onCollect()}
          disabled={busy}
          className="rounded-xl bg-[var(--jose-ink)] px-7 py-3.5 text-base font-semibold text-[var(--jose-paper)] shadow-md disabled:opacity-60"
        >
          {busy ? "Saving…" : "Collect journal artifact"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-5 px-6 py-12">
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <Icon className="size-7" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Journal artifact · {chest.artifact.kind}
          </p>
          <h1 className="font-display text-3xl font-semibold text-[var(--jose-ink)]">
            {chest.artifact.title}
          </h1>
        </div>
      </div>
      <p className="text-base text-[var(--jose-ink-muted)]">{chest.artifact.summary}</p>
      {chest.artifact.body ? (
        <blockquote className="rounded-2xl bg-white px-4 py-4 text-sm leading-relaxed text-[var(--jose-ink)] ring-1 ring-[var(--jose-rule)]">
          {chest.artifact.body}
        </blockquote>
      ) : null}
      <p className="text-xs font-semibold text-[var(--jose-ink-muted)]">
        Provenance: {chest.artifact.provenance}
      </p>
      {chest.journalCoverId ? (
        <p className="rounded-2xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900">
          Cosmetic journal cover unlocked: {chest.journalCoverId} (no loot box,
          no paywall).
        </p>
      ) : null}
      {duplicate ? (
        <p className="text-sm font-semibold text-[var(--jose-ink-muted)]" role="status">
          You already collected this artifact. Repeat completion does not
          duplicate rewards.
        </p>
      ) : (
        <p className="text-sm font-semibold text-emerald-800" role="status">
          Saved to your journal. Revisit it anytime from Profile.
        </p>
      )}
      <button
        type="button"
        onClick={onContinue}
        className="rounded-xl bg-[var(--jose-ink)] px-7 py-3.5 text-base font-semibold text-[var(--jose-paper)] shadow-md"
      >
        {nextLevelId ? "Continue to next" : "Continue"}
      </button>
    </div>
  );
}
