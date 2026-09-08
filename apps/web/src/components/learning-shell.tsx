"use client";

import { SkipLink } from "@/components/skip-link";
import { ThemeDocumentSync } from "@/lib/theme-mode";
import { t } from "@/lib/reading-preferences";
import { JoseSessionProvider, useJoseSession } from "@/lib/use-jose-session";
import { useReadingPreferences } from "@/lib/use-reading-preferences";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookMarked, Map, Settings, Sparkles, UserRound, Wrench, type LucideIcon } from "lucide-react";

const tabDefs: {
  href: string;
  labelKey: "nav.learn" | "nav.practice" | "nav.journal" | "nav.profile";
  icon: LucideIcon;
}[] = [
  { href: "/learn", labelKey: "nav.learn", icon: Map },
  { href: "/practice", labelKey: "nav.practice", icon: Sparkles },
  { href: "/bookmarks", labelKey: "nav.journal", icon: BookMarked },
  { href: "/profile", labelKey: "nav.profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  topBar,
}: {
  children: ReactNode;
  topBar?: ReactNode;
}) {
  return (
    <JoseSessionProvider>
      <div className="flex h-dvh overflow-hidden bg-transparent lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <SkipLink />
        <ThemeDocumentSync />
        <SideNav />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {topBar ? <div className="shrink-0">{topBar}</div> : null}
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain outline-none"
          >
            {children}
          </main>
          <BottomTabs />
        </div>
      </div>
    </JoseSessionProvider>
  );
}

function SideNav() {
  const pathname = usePathname();
  const prefs = useReadingPreferences();
  const { canTeach } = useJoseSession();

  return (
    <aside className="hidden h-dvh flex-col border-r border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 px-5 py-7 backdrop-blur-md lg:flex">
      <div className="mb-8 px-2">
        <p className="font-display text-4xl font-black tracking-tight text-[var(--jose-accent)]">
          Jose
        </p>
        <p className="mt-1 text-sm text-[var(--jose-ink-muted)]">
          Learn something new today
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-2" aria-label="Main">
        {tabDefs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          const label = t(prefs.locale, tab.labelKey);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3.5 rounded-2xl px-4 py-3.5 text-base font-extrabold transition ${
                active
                  ? "jose-nav-active"
                  : "text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
              }`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
              {label}
            </Link>
          );
        })}
        {canTeach ? (
          <Link
            href="/teach"
            aria-current={isActive(pathname, "/teach") ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3.5 rounded-2xl px-4 py-3.5 text-base font-extrabold transition ${
              isActive(pathname, "/teach")
                ? "jose-nav-active"
                : "text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
            }`}
          >
            <Wrench className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
            Teacher area
          </Link>
        ) : null}
      </nav>
      <div className="space-y-3 px-2">
        <Link href="/profile/preferences" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--jose-text-muted)]"><Settings className="size-5" aria-hidden /> Settings</Link>
      </div>
    </aside>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  const prefs = useReadingPreferences();
  const { canTeach } = useJoseSession();

  return (
    <nav
      className="shrink-0 border-t border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex w-full max-w-3xl items-stretch justify-around px-2 pt-2.5">
        {tabDefs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          const label = t(prefs.locale, tab.labelKey);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                active
                  ? "jose-nav-active"
                  : "text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
              }`}
            >
              <Icon className="size-5" strokeWidth={2.25} aria-hidden />
              {label}
            </Link>
          );
        })}
        {canTeach ? (
          <Link
            href="/teach"
            aria-current={isActive(pathname, "/teach") ? "page" : undefined}
            className={`flex min-h-11 min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
              isActive(pathname, "/teach")
                ? "jose-nav-active"
                : "text-[var(--jose-text-muted)] hover:bg-[var(--jose-surface-control)]"
            }`}
          >
            <Wrench className="size-5" strokeWidth={2.25} aria-hidden />
            Teacher area
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
