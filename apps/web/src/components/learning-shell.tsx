"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Map, Sparkles, UserRound, type LucideIcon } from "lucide-react";

const tabs: {
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/learn", label: "Learn", icon: Map },
  { href: "/practice", label: "Practice", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: UserRound },
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
      <SideNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {topBar ? <div className="shrink-0">{topBar}</div> : null}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {children}
        </main>
        <BottomTabs />
      </div>
    </div>
  );
}

function SideNav() {
  const pathname = usePathname();

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
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3.5 rounded-3xl px-4 py-3.5 text-lg font-extrabold transition ${
                active
                  ? "bg-violet-100 text-violet-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-6 shrink-0" strokeWidth={2.4} aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <p className="px-2 text-sm font-bold text-slate-400">
        Kids-first Rizal path
      </p>
    </aside>
  );
}

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-black/10 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex w-full max-w-3xl items-stretch justify-around px-2 pt-2.5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-[5rem] flex-col items-center gap-1 rounded-3xl px-3 py-2.5 text-xs font-extrabold transition sm:text-sm ${
                active
                  ? "bg-violet-100 text-violet-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-6" strokeWidth={2.4} aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
