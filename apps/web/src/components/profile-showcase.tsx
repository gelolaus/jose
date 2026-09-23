/* eslint-disable @next/next/no-img-element */
"use client";

import { LivesCountdown } from "@/components/lives-countdown";
import { StatusHud } from "@/components/status-hud";
import { getAvatarOption } from "@/lib/avatar-catalog";
import { logoutJose } from "@/lib/auth-api";
import { clearSensitiveClientState, isAvatarId } from "@/lib/explorer-identity";
import { useExplorerIdentity } from "@/lib/use-explorer-identity";
import { useJoseSession } from "@/lib/use-jose-session";
import type { ProfileStatsResponse } from "@jose/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProfileShowcase({ stats }: { stats: ProfileStatsResponse }) {
  const identity = useExplorerIdentity(stats.learner.displayName);
  const { authenticated, canAdmin, loading, user } = useJoseSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const avatarId =
    stats.learner.avatarId && isAvatarId(stats.learner.avatarId)
      ? stats.learner.avatarId
      : identity.avatarId;
  const avatar = getAvatarOption(avatarId);
  const AvatarEmblem = avatar.icon;
  const displayName = stats.learner.displayName || identity.displayName;
  const { hearts, streak, xp } = stats.learner;
  const latestAchievements = stats.achievements
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0))
    .slice(0, 2);
  const inProgressModule = stats.modules.find(
    (module) => module.completedCount > 0 && module.completedCount < module.totalCount,
  );

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
    <section className="profile-sheet" aria-label="Character sheet">
      <div className="profile-sheet__inner">
        <div className="profile-sheet__crest" aria-hidden="true">✦ Character Sheet ✦</div>

        <section className="profile-sheet__core" aria-labelledby="profile-name">
          <div className="profile-sheet__avatar-frame">
            <img
              src="/assets/ui/profile/warrior-avatar.png"
              alt="Pixel-art Filipino warrior avatar"
              className="profile-sheet__avatar-img"
            />
            <span className="profile-sheet__avatar-emblem" title={`Selected emblem: ${avatar.label}`}>
              <AvatarEmblem aria-hidden="true" size={18} strokeWidth={2.5} />
              <span className="sr-only">Selected emblem: {avatar.label}</span>
            </span>
          </div>
          <h1 id="profile-name" className="profile-sheet__name">{displayName}</h1>
          {user?.admissionEmail ? (
            <p className="profile-sheet__email">{user.admissionEmail}</p>
          ) : null}

          <div className="profile-sheet__hud-row">
            <StatusHud xp={xp} streak={streak} hearts={hearts} variant="profile" />
            <details className="profile-sheet__lives-help">
              <summary aria-label="About lives">i</summary>
              <div className="profile-sheet__lives-popover">
                <strong>Lives</strong>
                <p>{stats.rules.hearts}</p>
                <LivesCountdown
                  hearts={hearts}
                  heartsUpdatedAt={stats.learner.heartsUpdatedAt}
                  nextHeartAt={stats.learner.nextHeartAt}
                  serverNow={stats.learner.serverNow}
                />
              </div>
            </details>
          </div>
          <Link href="/profile/edit" className="profile-sheet__wood-button profile-sheet__wood-button--small">
            Customize Avatar
          </Link>
        </section>

        <div className="profile-sheet__lower">
          <section className="profile-sheet__milestones" aria-labelledby="milestones-heading">
            <h2 id="milestones-heading">Journey Milestones</h2>
            <div className="profile-sheet__milestone-rail">
              <span className="profile-sheet__milestone" title={`${stats.totals.completedLevels} levels completed`}>
                <img src="/assets/path-book-pixel.png" alt="" />
                <span>{stats.totals.completedLevels} levels</span>
              </span>
              <span className="profile-sheet__milestone" title={`${stats.totals.chestsOpened} chests opened`}>
                <img src="/assets/path-chest-pixel.png" alt="" />
                <span>{stats.totals.chestsOpened} treasures</span>
              </span>
              <span className="profile-sheet__milestone" title={`${stats.achievements.filter((achievement) => achievement.unlocked).length} badges earned`}>
                <img src="/assets/ui/hud/agimat-sun.png" alt="" />
                <span>{stats.achievements.filter((achievement) => achievement.unlocked).length} badges</span>
              </span>
            </div>
          </section>

          <aside className="profile-sheet__side" aria-label="Status and settings">
            <section className="profile-sheet__panel" aria-labelledby="activity-heading">
              <h2 id="activity-heading">Adventure Log</h2>
              <ul className="profile-sheet__log">
                {latestAchievements.map((achievement) => (
                  <li key={achievement.id}>
                    <img src="/assets/ui/hud/agimat-sun.png" alt="" />
                    <span>Earned: {achievement.title}</span>
                  </li>
                ))}
                {inProgressModule ? (
                  <li>
                    <img src="/assets/path-book-pixel.png" alt="" />
                    <span>{inProgressModule.title}: {inProgressModule.completedCount}/{inProgressModule.totalCount} levels</span>
                  </li>
                ) : null}
                <li>
                  <img src="/assets/ui/hud/kalan-fire.png" alt="" />
                  <span>Current streak: {streak} {streak === 1 ? "day" : "days"}</span>
                </li>
              </ul>
            </section>

            <section className="profile-sheet__panel profile-sheet__panel--help" aria-labelledby="account-heading">
              <h2 id="account-heading">Account &amp; Help</h2>
              <ul className="profile-sheet__links">
                <li><Link href="/profile/preferences"><span aria-hidden="true">⚙</span> Account Settings</Link></li>
                <li><Link href="/learn#classes"><span aria-hidden="true">▣</span> My Classes</Link></li>
                {!loading && canAdmin ? (
                  <li><Link href="/admin/teachers"><span aria-hidden="true">▣</span> Manage Teachers</Link></li>
                ) : null}
                <li>
                  <details>
                    <summary><span aria-hidden="true">?</span> Help</summary>
                    <p>{stats.rules.xp} {stats.rules.streak}</p>
                  </details>
                </li>
              </ul>
            </section>
          </aside>
        </div>

        <div className="profile-sheet__actions">
          <Link href="/profile/edit" className="profile-sheet__wood-button">Edit Profile</Link>
          {!loading && authenticated ? (
            <button type="button" onClick={onSignOut} disabled={signingOut} className="profile-sheet__wood-button">
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          ) : null}
          {!loading && !authenticated ? (
            <Link href="/login" className="profile-sheet__wood-button">School sign-in</Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
