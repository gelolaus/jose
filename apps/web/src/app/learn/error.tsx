"use client";

import { RecoveryState } from "@/components/recovery-state";
import { AppShell } from "@/components/learning-shell";

export default function LearnError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <RecoveryState
        title="Learning hit a snag"
        error="Something went wrong while opening this page. Your place in the lesson is kept — try again when ready."
        href="/learn"
      />
      <div className="pb-10 text-center">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-full bg-slate-800 px-5 py-2.5 text-sm font-extrabold text-white"
        >
          Retry without leaving
        </button>
      </div>
    </AppShell>
  );
}
