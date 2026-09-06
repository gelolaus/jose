"use client";

import { PresentationToggle } from "@/components/presentation-toggle";
import { PresentationDocumentSync } from "@/lib/presentation-mode";
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
    <div className="flex h-dvh overflow-hidden bg-transparent lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PresentationDocumentSync />
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
    <aside className="hidden h-dvh flex-col border-r border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 px-5 py-7 backdrop-blur-md lg:flex">
      <div className="mb-8 px-2">
        <p className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)]">
          Jose
        </p>
        <p className="mt-1 text-sm text-[var(--jose-ink-muted)]">
          Historical investigation
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-2" aria-label="Main">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-semibold transition ${
                active
                  ? "bg-teal-100 text-teal-900 shadow-sm"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 px-2">
        <PresentationToggle compact />
        <p className="text-sm text-stone-500">
          Field journal for APC RIZLIFE
        </p>
      </div>
    </aside>
  );
}

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
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
              className={`flex min-w-[5rem] flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
                active
                  ? "bg-teal-100 text-teal-900"
                  : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              <Icon className="size-5" strokeWidth={2.25} aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
