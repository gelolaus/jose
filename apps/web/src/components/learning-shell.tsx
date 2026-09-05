"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookMarked, Map, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { SkipLink } from "@/components/skip-link";
import { t } from "@/lib/reading-preferences";
import { useReadingPreferences } from "@/lib/use-reading-preferences";

const tabDefs: {
  href: string;
  labelKey: "nav.learn" | "nav.practice" | "nav.journal" | "nav.profile";
  icon: LucideIcon;
}[] = [
  { href: "/learn", labelKey: "nav.learn", icon: Map },
  { href: "/practice", labelKey: "nav.practice", icon: Sparkles },
  { href: "/journal", labelKey: "nav.journal", icon: BookMarked },
  { href: "/profile", labelKey: "nav.profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * App chrome: header + footer stay put; only the main pane scrolls.
 */
export function AppShell({
  children,
  topBar,
}: {
  children: ReactNode;
  topBar?: ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--jose-cream)] lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SkipLink />
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
  );
}

function SideNav() {
  const pathname = usePathname();
  const prefs = useReadingPreferences();

  return (
    <aside className="hidden h-dvh flex-col border-r border-black/8 bg-white/95 px-5 py-7 backdrop-blur-md lg:flex">
      <div className="mb-10 px-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
          Jose
        </p>
        <p className="font-display text-3xl font-semibold tracking-tight text-slate-800">
          Adventure
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-2.5" aria-label="Main">
        {tabDefs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          const label = t(prefs.locale, tab.labelKey);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3.5 rounded-3xl px-4 py-3.5 text-lg font-extrabold transition ${
                active
                  ? "bg-violet-100 text-violet-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-6 shrink-0" strokeWidth={2.4} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="px-2 text-sm font-bold text-slate-400">
        Historical investigation path
      </p>
    </aside>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  const prefs = useReadingPreferences();

  return (
    <nav
      className="shrink-0 border-t border-black/10 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
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
              className={`flex min-h-11 min-w-[4.5rem] flex-col items-center gap-1 rounded-3xl px-2 py-2.5 text-xs font-extrabold transition sm:text-sm ${
                active
                  ? "bg-violet-100 text-violet-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-6" strokeWidth={2.4} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
