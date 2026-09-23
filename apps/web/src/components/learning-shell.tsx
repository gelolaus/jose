/* eslint-disable @next/next/no-img-element */
"use client";

import { JoseShell } from "@/components/jose-shell";
import { TopBar } from "@/components/top-bar";
import { t } from "@/lib/reading-preferences";
import { JoseSessionProvider, useJoseSession } from "@/lib/use-jose-session";
import { useReadingPreferences } from "@/lib/use-reading-preferences";
import { NAVIGATION_IMAGES } from "@/lib/ui-assets";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BookMarked,
  Map,
  Sparkles,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

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
      <AppShellBody topBar={topBar}>{children}</AppShellBody>
    </JoseSessionProvider>
  );
}

function AppShellBody({
  children,
  topBar,
}: {
  children: ReactNode;
  topBar?: ReactNode;
}) {
  const prefs = useReadingPreferences();
  const { canTeach, learner } = useJoseSession();
  const pathname = usePathname();
  const showStatusHud = isActive(pathname, "/learn");
  const statusBar = showStatusHud
    ? (topBar ??
      (learner ? (
        <TopBar courseTitle="Jose" streak={learner.streak} hearts={learner.hearts} xp={learner.xp} />
      ) : undefined))
    : undefined;

  return (
    <JoseShell
      topBar={statusBar}
      brandSubtitle="Learn something new today"
      tabs={tabDefs.map((tab) => ({
        href: tab.href,
        label: t(prefs.locale, tab.labelKey),
        icon: tab.icon,
      }))}
      extraTabs={
        canTeach
          ? [
              {
                href: "/teach",
                label: "Teacher area",
                icon: Wrench,
                isActive: (path) => isActive(path, "/teach"),
              },
            ]
          : []
      }
      footer={
        <div className={`nav-item-img ${isActive(pathname, "/profile/preferences") ? "active" : ""}`}>
          <Link
            href="/profile/preferences"
            className="nav-image-link"
            aria-label="Settings"
            aria-current={isActive(pathname, "/profile/preferences") ? "page" : undefined}
          >
            <img
              src={NAVIGATION_IMAGES["/profile/preferences"]}
              alt="Settings"
              className="nav-btn-img"
            />
          </Link>
        </div>
      }
    >
      {children}
    </JoseShell>
  );
}
