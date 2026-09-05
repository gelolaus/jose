"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Layers } from "lucide-react";

export function TeachShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const modulesActive = pathname === "/teach" || pathname.startsWith("/teach/modules");

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--jose-cream)] lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="hidden h-dvh flex-col border-r border-black/8 bg-white/95 px-5 py-7 lg:flex">
        <div className="mb-10 px-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
            Jose
          </p>
          <p className="font-display text-3xl font-semibold tracking-tight text-slate-800">
            Teach
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-2.5" aria-label="Teacher">
          <Link
            href="/teach"
            aria-current={modulesActive ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3.5 rounded-3xl px-4 py-3.5 text-lg font-extrabold ${
              modulesActive
                ? "bg-violet-100 text-violet-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="size-6 shrink-0" strokeWidth={2.4} aria-hidden />
            Modules
          </Link>
          <Link
            href="/learn"
            className="mt-auto flex items-center gap-3.5 rounded-3xl px-4 py-3.5 text-lg font-extrabold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="size-6 shrink-0" strokeWidth={2.4} aria-hidden />
            Student view
          </Link>
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-black/5 bg-white/95 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold text-slate-800">
              Teacher studio
            </p>
            <Link
              href="/learn"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
            >
              Student view
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function TeachTitle({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-500">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-extrabold text-slate-600">
      {children}
    </label>
  );
}

export const COVER_COLORS = [
  "#A855F7",
  "#22C55E",
  "#38BDF8",
  "#F97316",
  "#EF4444",
  "#F5C518",
  "#FB7185",
];
