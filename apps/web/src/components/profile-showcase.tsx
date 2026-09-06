"use client";

import { ExplorerAvatar } from "@/components/explorer-avatar";
import { logoutJose } from "@/lib/auth-api";
import { clearSensitiveClientState, isAvatarId } from "@/lib/explorer-identity";
import {
  useExplorerIdentity,
} from "@/lib/use-explorer-identity";
import { useJoseSession } from "@/lib/use-jose-session";
import {
  deriveTrophies,
  highlightSectionId,
  sectionProgress,
} from "@/lib/profile-derived";
import type { PathResponse } from "@jose/shared";
import { Flame, Heart, Lock, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ProfileShowcaseProps = {
  path: PathResponse;
};

export function ProfileShowcase({ path }: ProfileShowcaseProps) {
  const identity = useExplorerIdentity(path.learner.displayName);
  const { authenticated, canTeach, loading } = useJoseSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Server truth wins over the locally cached explorer look.
  const avatarId =
    path.learner.avatarId && isAvatarId(path.learner.avatarId)
      ? path.learner.avatarId
      : identity.avatarId;
  const displayName = path.learner.displayName || identity.displayName;

  const trophies = deriveTrophies(path);
  const activeSectionId = highlightSectionId(path);
  const { streak, hearts, xp } = path.learner;

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col items-center gap-4 text-center">
        <ExplorerAvatar avatarId={avatarId} floating />
        <div className="space-y-1.5">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-800 md:text-5xl">
            {displayName}
          </h1>
          <p className="text-base font-semibold text-slate-500 md:text-lg">
            Rizal path explorer
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
            className="rounded-full bg-rose-500 px-6 py-3 text-base font-extrabold text-white shadow-md transition active:translate-y-0.5 active:shadow-sm"
          >
            Edit explorer
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
        <StatChip tone="rose" icon={Heart} label={`${hearts} hearts`} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">
          Journey
        </h2>
        <p className="text-sm font-semibold text-slate-500">
          Where you are on the Rizal path
        </p>
        <ul className="flex flex-col gap-2.5">
          {path.sections.map((section) => {
            const { completed, total } = sectionProgress(section);
            const active = section.id === activeSectionId;
            return (
              <li
                key={section.id}
                className={`flex items-center justify-between gap-3 rounded-3xl px-4 py-3.5 transition ${
                  active ? "bg-white shadow-md ring-2" : "bg-white/70 ring-1 ring-black/5"
                }`}
                style={
                  active
                    ? { boxShadow: `0 0 0 2px ${section.themeColor}` }
                    : undefined
                }
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="size-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: section.themeColor }}
                    aria-hidden
                  />
                  <span className="truncate text-base font-extrabold text-slate-700">
                    {section.title}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-500">
                  {completed}/{total}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 pb-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800">
          Trophies
        </h2>
        <p className="text-sm font-semibold text-slate-500">
          Little wins along the way
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {trophies.map((trophy) => (
            <li
              key={trophy.id}
              className={`flex items-center gap-3 rounded-3xl px-4 py-4 ring-1 sm:flex-col sm:text-center ${
                trophy.unlocked
                  ? "bg-[var(--jose-gold)]/20 ring-amber-300/80"
                  : "bg-white/60 ring-black/5 opacity-70"
              }`}
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                  trophy.unlocked
                    ? "bg-[var(--jose-gold)] text-amber-900"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {trophy.unlocked ? (
                  <Trophy className="size-6" strokeWidth={2.4} aria-hidden />
                ) : (
                  <Lock className="size-6" strokeWidth={2.4} aria-hidden />
                )}
              </span>
              <div className="min-w-0 sm:space-y-0.5">
                <p className="text-sm font-extrabold text-slate-800">
                  {trophy.title}
                </p>
                <p className="text-xs font-bold text-slate-500">
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
    sky: "bg-sky-100 text-sky-700",
    coral: "bg-orange-100 text-orange-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold tabular-nums shadow-sm transition active:translate-y-0.5 active:shadow-none sm:text-base ${tones[tone]}`}
    >
      <Icon className="size-5" strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  );
}
