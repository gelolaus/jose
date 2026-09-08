"use client";

import type { ReactNode } from "react";

export function OverflowMenu({
  label = "More",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="relative">
      <summary
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
        aria-label={label}
      >
        <span aria-hidden className="text-lg font-black leading-none">
          ⋯
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-2xl bg-[var(--jose-paper)] p-1 shadow-lg ring-1 ring-[var(--jose-rule)]">
        {children}
      </div>
    </details>
  );
}

export function OverflowItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-extrabold disabled:opacity-40 ${
        danger ? "text-[var(--jose-coral)]" : "text-[var(--jose-ink)]"
      }`}
    >
      {children}
    </button>
  );
}
