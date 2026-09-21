/* eslint-disable @next/next/no-img-element */
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

const navImageByPath: Record<string, string> = {
  "/learn": "/assets/nav-learn.png",
  "/practice": "/assets/nav-practice.png",
  "/bookmarks": "/assets/nav-bookmarks.png",
  "/profile": "/assets/nav-profile.png",
  "/profile/preferences": "/assets/nav-settings.png",
};

function navImageFor(href: string) {
  return navImageByPath[href];
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
  const allTabs = [...tabs, ...extraTabs];

  return (
    <div
      className="flex h-dvh overflow-hidden bg-transparent md:grid md:grid-cols-[15rem_minmax(0,1fr)]"
      data-accent={accent}
    >
      <SkipLink />
      <ThemeDocumentSync />
      <aside className="jose-sidebar hidden h-dvh flex-col px-5 py-7 md:flex">
        <div className="sidebar-logo mb-5 px-2">
          <img
            src="/assets/jose-title.png"
            alt={brandTitle}
            className="jose-title-img jose-title-img--sidebar"
          />
          {brandSubtitle ? (
            <p className="mt-1 text-sm text-[var(--jose-sidebar-muted)]">{brandSubtitle}</p>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col" aria-label={navLabel}>
          <ul className="nav-image-list">
          {allTabs.map((tab) => {
            const active = tabIsActive(pathname, tab);
            const imageSrc = navImageFor(tab.href);
            return (
              <li
                key={`${tab.href}-${tab.label}`}
                className={`nav-item-img ${active ? "active" : ""}`}
              >
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={tab.label}
                  className="nav-image-link"
                >
                  {imageSrc ? (
                    <img src={imageSrc} alt={tab.label} className="nav-btn-img" />
                  ) : (
                    <span className="nav-image-fallback">{tab.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
          </ul>
        </nav>
        {footer ? <div className="space-y-3 px-2">{footer}</div> : null}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {topBar ? <div className="shrink-0">{topBar}</div> : null}
        <main
          id="main-content"
          tabIndex={-1}
          className="jose-shell-main min-h-0 flex-1 overflow-y-auto overscroll-y-contain outline-none"
        >
          {children}
        </main>
        <nav
          className="jose-bottom-nav shrink-0 border-t border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
          aria-label={navLabel}
        >
          <ul className="nav-image-list nav-image-list--mobile">
            {allTabs.map((tab) => {
              const active = tabIsActive(pathname, tab);
              const imageSrc = navImageFor(tab.href);
              return (
                <li
                  key={`bottom-${tab.href}-${tab.label}`}
                  className={`nav-item-img ${active ? "active" : ""}`}
                >
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={tab.label}
                    className="nav-image-link"
                  >
                    {imageSrc ? (
                      <img src={imageSrc} alt={tab.label} className="nav-btn-img" />
                    ) : (
                      <span className="nav-image-fallback">{tab.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
