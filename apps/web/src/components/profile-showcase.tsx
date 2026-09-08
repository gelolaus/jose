"use client";

import { ExplorerAvatar } from "@/components/explorer-avatar";
import { logoutJose } from "@/lib/auth-api";
import { clearSensitiveClientState, isAvatarId } from "@/lib/explorer-identity";
import { useExplorerIdentity } from "@/lib/use-explorer-identity";
import { useJoseSession } from "@/lib/use-jose-session";
import type { ProfileStatsResponse } from "@jose/shared";
import { Flame, Heart, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LivesCountdown } from "@/components/lives-countdown";

export function ProfileShowcase({
  stats,
}: {
  stats: ProfileStatsResponse;
}) {
  const identity = useExplorerIdentity(stats.learner.displayName);
  const { authenticated, canTeach, canAdmin, loading, user } = useJoseSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const avatarId =
    stats.learner.avatarId && isAvatarId(stats.learner.avatarId)
      ? stats.learner.avatarId
      : identity.avatarId;
  const displayName = stats.learner.displayName || identity.displayName;
  const { streak, hearts, xp } = stats.learner;

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logoutJose();
      clearSensitiveClientState();
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="jose-surface mx-auto flex w-full max-w-xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col items-center gap-4 text-center">
        <ExplorerAvatar avatarId={avatarId} floating />
        <div className="space-y-1.5">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--jose-ink)]">
            {displayName}
          </h1>
          {user?.admissionEmail ? (
            <p className="text-sm font-semibold text-[var(--jose-ink-muted)]">
              {user.admissionEmail}
            </p>
          ) : null}
        </div>
        <Link href="/profile/edit" className="jose-button">
          Edit profile
        </Link>
      </section>

      <section aria-label="Stats" className="grid grid-cols-3 gap-3">
        <StatChip tone="sky" icon={Zap} label={`${xp} XP`} name={`${xp} experience points`} />
        <StatChip
          tone="coral"
          icon={Flame}
          label={`${streak}`}
          name={`${streak} day streak`}
        />
        <StatChip
          tone="rose"
          icon={Heart}
          label={`${hearts}`}
          name={`${hearts} lives`}
        />
      </section>
      <LivesCountdown
        hearts={hearts}
        heartsUpdatedAt={stats.learner.heartsUpdatedAt}
        nextHeartAt={stats.learner.nextHeartAt}
        serverNow={stats.learner.serverNow}
      />

      <section aria-labelledby="settings-heading" className="space-y-2">
        <h2 id="settings-heading" className="text-sm font-extrabold uppercase tracking-wide text-[var(--jose-ink-muted)]">
          Settings
        </h2>
        <ul className="flex flex-col gap-2">
          <SettingsLink href="/profile/preferences" label="Reading settings" />
          <SettingsLink href="/learn#classes" label="My classes" />
          {!loading && canTeach ? (
            <SettingsLink href="/teach" label="Teacher area" />
          ) : null}
          {!loading && canAdmin ? (
            <SettingsLink href="/admin/teachers" label="Manage teachers" />
          ) : null}
        </ul>
      </section>

      {!loading && !authenticated ? (
        <Link href="/login" className="jose-button text-center">
          School sign-in
        </Link>
      ) : null}

      {!loading && authenticated ? (
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="min-h-11 rounded-full bg-white px-6 py-3 text-base font-extrabold text-slate-600 shadow-sm ring-1 ring-black/10 disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      ) : null}

      <p className="text-sm text-[var(--jose-ink-muted)]">{stats.rules.hearts}</p>
    </div>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center rounded-2xl bg-white px-4 py-3 text-base font-extrabold ring-1 ring-black/5"
      >
        {label}
      </Link>
    </li>
  );
}

function StatChip({
  label,
  tone,
  icon: Icon,
  name,
}: {
  label: string;
  tone: "sky" | "coral" | "rose";
  icon: typeof Zap;
  name: string;
}) {
  const tones = {
    sky: "bg-cyan-100 text-cyan-900",
    coral: "bg-amber-100 text-amber-950",
    rose: "bg-rose-100 text-rose-900",
  };
  return (
    <span
      role="status"
      aria-label={name}
      className={`flex min-h-11 flex-col items-center justify-center rounded-2xl px-2 py-3 text-sm font-extrabold tabular-nums ${tones[tone]}`}
    >
      <Icon className="size-5" strokeWidth={2.25} aria-hidden />
      <span aria-hidden>{label}</span>
    </span>
  );
}
