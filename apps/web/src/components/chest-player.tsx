"use client";

import { completeLevel } from "@/lib/path-api";
import { Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ChestPlayer({
  levelId,
  moduleId,
  title,
  message,
  nextLevelId,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  message: string;
  nextLevelId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    setBusy(true);
    try {
      const result = await completeLevel(levelId);
      router.push(
        result.continueHref ??
          (nextLevelId
            ? `/learn/${moduleId}/${nextLevelId}`
            : `/learn/${moduleId}`),
      );
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex size-28 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-md">
        <Gift className="size-14" strokeWidth={2.2} aria-hidden />
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--jose-ink)]">
        {title}
      </h1>
      <p className="text-lg text-[var(--jose-ink-muted)]">{message}</p>
      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="rounded-xl bg-[var(--jose-ink)] px-7 py-3.5 text-base font-semibold text-[var(--jose-paper)] shadow-md disabled:opacity-60"
      >
        {busy ? "Saving…" : nextLevelId ? "Continue to next" : "Continue"}
      </button>
    </div>
  );
}
