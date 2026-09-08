"use client";

import { SkipLink } from "@/components/skip-link";
import { ThemeDocumentSync } from "@/lib/theme-mode";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type JoseShellTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: (pathname: string) => boolean;
};

function tabIsActive(pathname: string, tab: JoseShellTab) {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function JoseShell({
  children,
  topBar,
  tabs,
  extraTabs = [],
  accent = "learn",
  brandTitle = "Jose",
  brandSubtitle,
  footer,
  navLabel = "Main",
}: {
  children: ReactNode;
  topBar?: ReactNode;
  tabs: JoseShellTab[];
  extraTabs?: JoseShellTab[];
  accent?: "learn" | "teach";
  brandTitle?: string;
  brandSubtitle?: ReactNode;
  footer?: ReactNode;
  navLabel?: string;
}) {
  const pathname = usePathname();
  const activeClass = accent === "teach" ? "jose-nav-active-teach" : "jose-nav-active";
  const allTabs = [...tabs, ...extraTabs];

  return (
    <div className="flex h-dvh overflow-hidden bg-transparent lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <SkipLink />
      <ThemeDocumentSync />
      <aside className="hidden h-dvh flex-col border-r border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 px-5 py-7 backdrop-blur-md lg:flex">
        <div className="mb-8 px-2">
          <p className="font-display text-4xl font-black tracking-tight text-[var(--jose-accent)]">
            {brandTitle}
          </p>
          {brandSubtitle ? (
            <p className="mt-1 text-sm text-[var(--jose-ink-muted)]">{brandSubtitle}</p>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-2" aria-label={navLabel}>
          {allTabs.map((tab) => {
            const active = tabIsActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <Link
                key={`${tab.href}-${tab.label}`}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3.5 rounded-2xl px-4 py-3.5 text-base font-extrabold transition ${
                  active
                    ? activeClass
                    : "text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
                }`}
              >
                <Icon className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {footer ? <div className="space-y-3 px-2">{footer}</div> : null}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {topBar ? <div className="shrink-0">{topBar}</div> : null}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain outline-none"
        >
          {children}
        </main>
        <nav
          className="shrink-0 border-t border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
          aria-label={navLabel}
        >
          <div className="mx-auto flex w-full max-w-3xl items-stretch justify-around px-2 pt-2.5">
            {allTabs.map((tab) => {
              const active = tabIsActive(pathname, tab);
              const Icon = tab.icon;
              return (
                <Link
                  key={`bottom-${tab.href}-${tab.label}`}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                    active
                      ? activeClass
                      : "text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={2.25} aria-hidden />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
