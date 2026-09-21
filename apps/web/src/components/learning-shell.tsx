/* eslint-disable @next/next/no-img-element */
"use client";

import { JoseShell } from "@/components/jose-shell";
import { t } from "@/lib/reading-preferences";
import { JoseSessionProvider, useJoseSession } from "@/lib/use-jose-session";
import { useReadingPreferences } from "@/lib/use-reading-preferences";
import Link from "next/link";
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
  const { canTeach } = useJoseSession();

  return (
    <JoseShell
      topBar={topBar}
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
        <Link
          href="/profile/preferences"
          className="nav-image-link"
          aria-label="Settings"
        >
          <img
            src="/assets/nav-settings.png"
            alt="Settings"
            className="nav-btn-img"
          />
        </Link>
      }
    >
      {children}
    </JoseShell>
  );
}
