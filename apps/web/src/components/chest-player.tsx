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
}: {
  levelId: string;
  moduleId: string;
  title: string;
  message: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    setBusy(true);
    try {
      await completeLevel(levelId);
      router.push(`/learn/${moduleId}`);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex size-28 items-center justify-center rounded-[2rem] bg-amber-100 text-amber-700 shadow-md">
        <Gift className="size-14" strokeWidth={2.3} aria-hidden />
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-800">
        {title}
      </h1>
      <p className="text-lg font-semibold text-slate-600">{message}</p>
      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="rounded-full bg-violet-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-60"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
