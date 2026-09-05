"use client";

import {
  usePresentationMode,
  writePresentationMode,
  type PresentationMode,
} from "@/lib/presentation-mode";

export function PresentationToggle({ compact = false }: { compact?: boolean }) {
  const mode = usePresentationMode();

  function choose(next: PresentationMode) {
    writePresentationMode(next);
  }

  return (
    <div
      role="group"
      aria-label="Presentation"
      className={`inline-flex rounded-xl border border-[var(--jose-rule)] bg-white/80 p-1 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {(["adventure", "focus"] as const).map((option) => {
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => choose(option)}
            className={`rounded-lg px-3 py-1.5 font-semibold capitalize transition ${
              active
                ? "bg-[var(--jose-ink)] text-[var(--jose-paper)]"
                : "text-[var(--jose-ink-muted)] hover:text-[var(--jose-ink)]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
