"use client";

import { useTheme, writeTheme, type Theme } from "@/lib/theme-mode";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();

  function choose(next: Theme) {
    writeTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`inline-flex rounded-xl border border-[var(--jose-rule)] bg-[var(--jose-paper)]/80 p-1 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {(["light", "dark"] as const).map((option) => {
        const active = theme === option;
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
