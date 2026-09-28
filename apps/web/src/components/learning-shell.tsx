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

function showsStreakChip(pathname: string) {
  return (
    isActive(pathname, "/practice") ||
    isActive(pathname, "/bookmarks") ||
    isActive(pathname, "/profile")
  );
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

function ShellStreakChip({ streak }: { streak: number }) {
  const label = `${streak} day streak`;
  return (
    <div className="shell-streak-bar">
      <p className="shell-streak-chip" role="status" aria-label={label}>
        <img src="/assets/ui/hud/kalan-fire.png" alt="" className="shell-streak-chip__icon" />
        <span>{label}</span>
      </p>
    </div>
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
  const pathname = usePathname() ?? "";
  const onLearn = isActive(pathname, "/learn");
  const learnHud = onLearn
    ? (topBar ??
      (learner ? (
        <TopBar courseTitle="Jose" streak={learner.streak} hearts={learner.hearts} xp={learner.xp} />
      ) : undefined))
    : undefined;
  const streakChip =
    learner && !onLearn && showsStreakChip(pathname) ? (
      <ShellStreakChip streak={learner.streak} />
    ) : null;
  const showHeader = canTeach || learnHud != null || streakChip != null;
  const settingsActive = isActive(pathname, "/profile/preferences");

  return (
    <JoseShell
      topBar={
        showHeader ? (
          <>
            {canTeach ? (
              <div className="shell-teacher-bar">
                <Link href="/teach" className="shell-teacher-link">
                  Teacher area
                </Link>
              </div>
            ) : null}
            {learnHud}
            {streakChip}
          </>
        ) : undefined
      }
      brandSubtitle="Learn something new today"
      tabs={tabDefs.map((tab) => ({
        href: tab.href,
        label: t(prefs.locale, tab.labelKey),
        icon: tab.icon,
      }))}
      mobileDock={
        <Link
          href="/profile/preferences"
          className={`shell-settings-link${settingsActive ? " active" : ""}`}
          aria-current={settingsActive ? "page" : undefined}
        >
          <img
            src={NAVIGATION_IMAGES["/profile/preferences"]}
            alt=""
            className="shell-settings-link__img"
          />
          <span className="shell-settings-link__label">Settings</span>
        </Link>
      }
      footer={
        <div className={`nav-item-img ${settingsActive ? "active" : ""}`}>
          <Link
            href="/profile/preferences"
            className="nav-image-link"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
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
