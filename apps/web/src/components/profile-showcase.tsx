"use client";

import { ExplorerAvatar } from "@/components/explorer-avatar";
import { logoutJose } from "@/lib/auth-api";
import { clearSensitiveClientState, isAvatarId } from "@/lib/explorer-identity";
import { useExplorerIdentity } from "@/lib/use-explorer-identity";
import { useJoseSession } from "@/lib/use-jose-session";
import type { ProfileStatsResponse } from "@jose/shared";
import { Flame, Heart, Lock, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProfileShowcase({ stats }: { stats: ProfileStatsResponse }) {
  const identity = useExplorerIdentity(stats.learner.displayName);
  const { authenticated, canTeach, loading } = useJoseSession();
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
    <div className="jose-surface mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col items-center gap-4 text-center">
        <ExplorerAvatar avatarId={avatarId} floating />
        <div className="space-y-1.5">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--jose-ink)] md:text-5xl">
            {displayName}
          </h1>
          <p className="text-base text-[var(--jose-ink-muted)] md:text-lg">
            Jose field journal
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          {!loading && !authenticated ? (
            <Link
              href="/login"
              className="rounded-full bg-violet-600 px-6 py-3 text-base font-extrabold text-white shadow-md transition active:translate-y-0.5 active:shadow-sm"
            >
              School sign-in
            </Link>
          ) : null}
          <Link
            href="/profile/edit"
            className="rounded-xl bg-rose-800 px-6 py-3 text-base font-semibold text-white shadow-md transition active:translate-y-0.5 active:shadow-sm"
          >
            Edit explorer
          </Link>
          <Link
            href="/profile/preferences"
            className="min-h-11 rounded-xl bg-violet-100 px-6 py-3 text-base font-semibold text-violet-800 shadow-sm"
          >
            Language & reading
          </Link>
          <Link
            href="/journal"
            className="min-h-11 rounded-xl bg-amber-100 px-6 py-3 text-base font-semibold text-amber-900 shadow-sm"
          >
            Field journal
          </Link>
          {!loading && canTeach ? (
            <Link
              href="/teach"
              className="rounded-full bg-slate-800 px-6 py-3 text-base font-extrabold text-white shadow-md transition active:translate-y-0.5 active:shadow-sm"
            >
              Teacher studio
            </Link>
          ) : null}
          {!loading && authenticated ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="rounded-full bg-white px-6 py-3 text-base font-extrabold text-slate-600 shadow-sm ring-1 ring-black/10 transition active:translate-y-0.5 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : null}
        </div>
      </section>

      <section aria-label="Stats" className="flex flex-wrap items-center justify-center gap-3">
        <StatChip tone="sky" icon={Zap} label={`${xp} XP`} />
        <StatChip tone="coral" icon={Flame} label={`${streak} day streak`} />
        <StatChip tone="rose" icon={Heart} label={`${hearts} arcade lives`} />
      </section>

      <section className="rounded-2xl border border-[var(--jose-rule)] bg-white/80 px-4 py-4 text-sm text-[var(--jose-ink-muted)]">
        <p>
          <span className="font-semibold text-[var(--jose-ink)]">Course total:</span>{" "}
          {stats.totals.completedLevels}/{stats.totals.totalLevels} levels ·{" "}
          {stats.totals.chestsOpened} chests
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-[var(--jose-ink)]">
            How XP, streak, and hearts work
          </summary>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>{stats.rules.xp}</li>
            <li>{stats.rules.streak}</li>
            <li>{stats.rules.hearts}</li>
          </ul>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--jose-ink)]">
          Journey across modules
        </h2>
        <p className="text-sm text-[var(--jose-ink-muted)]">
          Aggregated from every published module on your account
        </p>
        <ul className="flex flex-col gap-2.5">
          {stats.modules.map((mod) => (
            <li
              key={mod.moduleId}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-black/5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: mod.coverColor }}
                  aria-hidden
                />
                <span className="truncate text-base font-semibold text-stone-700">
                  {mod.title}
                  {mod.featured ? " · featured" : ""}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-500">
                {mod.completedCount}/{mod.totalCount}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 pb-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--jose-ink)]">
          Achievements
        </h2>
        <p className="text-sm text-[var(--jose-ink-muted)]">
          Earned badges stay unlocked even after you finish the course
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.achievements.map((trophy) => (
            <li
              key={trophy.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-4 ring-1 ${
                trophy.unlocked
                  ? "bg-amber-50 ring-amber-300/80"
                  : "bg-white/60 ring-black/5 opacity-70"
              }`}
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
                  trophy.unlocked
                    ? "bg-amber-200 text-amber-950"
                    : "bg-stone-100 text-stone-400"
                }`}
              >
                {trophy.unlocked ? (
                  <Trophy className="size-6" strokeWidth={2.25} aria-hidden />
                ) : (
                  <Lock className="size-6" strokeWidth={2.25} aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-800">{trophy.title}</p>
                <p className="text-xs text-stone-500">{trophy.description}</p>
                <p className="text-xs font-semibold text-stone-500">
                  {trophy.unlocked ? "Unlocked" : "Locked"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatChip({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone: "sky" | "coral" | "rose";
  icon: typeof Zap;
}) {
  const tones = {
    sky: "bg-cyan-100 text-cyan-900",
    coral: "bg-orange-100 text-orange-900",
    rose: "bg-rose-100 text-rose-900",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold tabular-nums shadow-sm transition active:translate-y-0.5 active:shadow-none sm:text-base ${tones[tone]}`}
    >
      <Icon className="size-5" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}
