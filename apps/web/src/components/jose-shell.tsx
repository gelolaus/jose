/* eslint-disable @next/next/no-img-element */
"use client";

import { SkipLink } from "@/components/skip-link";
import { ThemeDocumentSync } from "@/lib/theme-mode";
import { JOSE_TITLE_IMAGE, NAVIGATION_IMAGES } from "@/lib/ui-assets";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

function navImageFor(href: string) {
  return NAVIGATION_IMAGES[href];
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className="jose-shell relative flex h-dvh overflow-hidden bg-transparent md:grid"
      data-accent={accent}
      data-sidebar-collapsed={sidebarCollapsed}
    >
      <SkipLink />
      <ThemeDocumentSync />
      <aside
        id="jose-sidebar"
        className="jose-sidebar hidden h-dvh min-w-0 flex-col overflow-hidden px-5 py-7 md:flex"
        aria-hidden={sidebarCollapsed}
        inert={sidebarCollapsed}
      >
        <div className="sidebar-logo mb-5 px-2">
          <img
            src={JOSE_TITLE_IMAGE}
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
            const Icon = tab.icon;
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
                    <Icon className="nav-fallback-icon" aria-hidden />
                  )}
                </Link>
              </li>
            );
          })}
          </ul>
        </nav>
        {footer ? <div className="w-full space-y-3">{footer}</div> : null}
      </aside>
      <button
        type="button"
        className="jose-sidebar-toggle"
        onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        aria-controls="jose-sidebar"
        aria-expanded={!sidebarCollapsed}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
      </button>
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
              const Icon = tab.icon;
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
                      <Icon className="nav-fallback-icon" aria-hidden />
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
