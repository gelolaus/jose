"use client";

import { JoseShell } from "@/components/jose-shell";
import { ConnectedLocalDevPanel } from "@/components/local-dev-panel";
import { JoseSessionProvider, useJoseSession } from "@/lib/use-jose-session";
import Link from "next/link";
import type { ReactNode } from "react";
import { Layers, Map, Settings, UserRound, Users } from "lucide-react";

export function TeachShell({ children }: { children: ReactNode }) {
  return (
    <JoseSessionProvider>
      <TeachShellBody>{children}</TeachShellBody>
    </JoseSessionProvider>
  );
}

function TeachShellBody({ children }: { children: ReactNode }) {
  const { canTeach, loading } = useJoseSession();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--jose-cream)] px-6">
        <p className="font-semibold text-[var(--jose-ink-muted)]">Checking teacher access…</p>
      </div>
    );
  }

  if (!canTeach) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--jose-cream)] px-6 text-center">
        <div className="max-w-md space-y-3">
          <p className="font-display text-3xl font-semibold text-[var(--jose-ink)]">
            Teachers only
          </p>
          <p className="font-semibold text-[var(--jose-ink-muted)]">
            Teacher area needs a teacher or admin session. Students cannot open these
            tools, and an APC email alone does not grant access.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/login" className="jose-button">
              School sign-in
            </Link>
            <Link href="/learn" className="jose-button jose-button--secondary">
              Back to learning
            </Link>
          </div>
          <div className="mx-auto max-w-sm pt-2 text-left">
            <ConnectedLocalDevPanel />
          </div>
        </div>
      </div>
    );
  }

  return (
    <JoseShell
      accent="teach"
      navLabel="Teacher"
      brandSubtitle="Teach"
      tabs={[
        {
          href: "/teach",
          label: "Modules",
          icon: Layers,
          isActive: (path) => path === "/teach" || path.startsWith("/teach/modules"),
        },
        {
          href: "/teach/classes",
          label: "Classes",
          icon: Users,
          isActive: (path) => path.startsWith("/teach/classes"),
        },
        { href: "/learn", label: "Learn", icon: Map },
        { href: "/profile", label: "Profile", icon: UserRound },
      ]}
      footer={
        <div className="space-y-3">
          <Link
            href="/profile/preferences"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--jose-text-muted)]"
          >
            <Settings className="size-5" aria-hidden /> Settings
          </Link>
          <ConnectedLocalDevPanel compact />
        </div>
      }
    >
      {children}
    </JoseShell>
  );
}

export function TeachTitle({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--jose-teach)]">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--jose-ink)] sm:text-4xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-extrabold text-[var(--jose-ink-muted)]">
      {children}
    </label>
  );
}

export const COVER_COLORS = [
  "#A855F7",
  "#22C55E",
  "#38BDF8",
  "#F97316",
  "#EF4444",
  "#F5C518",
  "#FB7185",
];
