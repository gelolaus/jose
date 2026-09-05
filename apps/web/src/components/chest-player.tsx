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
}: {
  levelId: string;
  moduleId: string;
  title: string;
  chest: ChestContent;
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
      setBusy(false);
    }
  }

  function onContinue() {
    router.push(`/learn/${moduleId}`);
    router.refresh();
  }

  if (!opened) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <div className="flex size-28 items-center justify-center rounded-[2rem] bg-amber-100 text-amber-700 shadow-md">
          <Gift className="size-14" strokeWidth={2.3} aria-hidden />
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-800">
          {title}
        </h1>
        <p className="text-lg font-semibold text-slate-600">{chest.message}</p>
        <p className="text-sm font-bold text-slate-500">
          {chest.achievementCriteria}
        </p>
        {chest.artifact.approvalStatus === "draft" ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 ring-1 ring-amber-200">
            Draft artifact — teacher should approve provenance before publishing
            this stop.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-bold text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void onCollect()}
          disabled={busy}
          className="rounded-full bg-amber-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
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
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
            Journal artifact · {chest.artifact.kind}
          </p>
          <h1 className="font-display text-3xl font-semibold text-slate-900">
            {chest.artifact.title}
          </h1>
        </div>
      </div>
      <p className="text-base font-semibold text-slate-700">
        {chest.artifact.summary}
      </p>
      {chest.artifact.body ? (
        <blockquote className="rounded-[1.4rem] bg-white px-4 py-4 text-sm font-semibold leading-relaxed text-slate-700 ring-1 ring-black/10">
          {chest.artifact.body}
        </blockquote>
      ) : null}
      <p className="text-xs font-bold text-slate-500">
        Provenance: {chest.artifact.provenance}
      </p>
      {chest.journalCoverId ? (
        <p className="rounded-2xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900">
          Cosmetic journal cover unlocked: {chest.journalCoverId} (no loot box,
          no paywall).
        </p>
      ) : null}
      {duplicate ? (
        <p className="text-sm font-bold text-slate-600" role="status">
          You already collected this artifact. Repeat completion does not
          duplicate rewards.
        </p>
      ) : (
        <p className="text-sm font-bold text-emerald-700" role="status">
          Saved to your journal. Revisit it anytime from Profile.
        </p>
      )}
      <button
        type="button"
        onClick={onContinue}
        className="rounded-full bg-violet-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md"
      >
        Continue
      </button>
    </div>
  );
}
