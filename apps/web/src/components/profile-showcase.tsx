/* eslint-disable @next/next/no-img-element */
"use client";

import { LivesCountdown } from "@/components/lives-countdown";
import { StatusHud } from "@/components/status-hud";
import { getAvatarOption } from "@/lib/avatar-catalog";
import { logoutJose } from "@/lib/auth-api";
import { clearSensitiveClientState, isAvatarId } from "@/lib/explorer-identity";
import { moduleBookImage } from "@/lib/ui-assets";
import { useExplorerIdentity } from "@/lib/use-explorer-identity";
import { useJoseSession } from "@/lib/use-jose-session";
import type { ProfileStatsResponse } from "@jose/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatEarned(epochMs: number) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(epochMs));
}

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
  const badges = stats.badges ?? [];
  const earnedModuleIds = new Set(badges.map((badge) => badge.moduleId));
  const lockedModules = stats.modules.filter((module) => !earnedModuleIds.has(module.moduleId));
  const latestAchievements = stats.achievements
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0))
    .slice(0, 2);
  const newestBadge = badges[0];
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
          <div className="profile-sheet__avatar-frame" role="img" aria-label={`${avatar.label} avatar`}>
            <AvatarEmblem aria-hidden="true" size={64} strokeWidth={2.25} />
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
          <section className="profile-sheet__bookshelf" aria-labelledby="completed-books-heading">
            <div className="profile-sheet__shelf-heading">
              <h2 id="completed-books-heading" style={{ minWidth: 0 }}>Completed Books</h2>
              <span>{badges.length} earned</span>
            </div>
            {badges.length > 0 ? (
              <ul className="profile-sheet__book-list">
                {badges.map((badge, index) => {
                  const cover = moduleBookImage(index);
                  const earned = formatEarned(badge.earnedAt);
                  const body = (
                    <>
                      <img
                        src={cover}
                        alt=""
                        className="profile-sheet__book-cover"
                        style={{ backgroundColor: badge.coverColor }}
                      />
                      <span>{badge.title}</span>
                      <span>{earned}</span>
                    </>
                  );
                  return (
                    <li key={badge.moduleId}>
                      {badge.stillPublished ? (
                        <Link href={`/learn/${badge.moduleId}`} aria-label={`${badge.title}, module badge, earned ${earned}`}>
                          {body}
                        </Link>
                      ) : (
                        <div
                          aria-label={`${badge.title}, retired module`}
                          style={{
                            display: "flex",
                            width: "clamp(64px, 18vw, 90px)",
                            minHeight: 44,
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.3rem",
                            color: "#fff0d1",
                            fontSize: "0.68rem",
                            textAlign: "center",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {body}
                          <span>Retired module</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="profile-sheet__shelf-empty">
                <p>No completed books yet</p>
                <span>Finish every level in a module to add its badge.</span>
                <Link href="/learn">Explore modules</Link>
              </div>
            )}
            {lockedModules.length > 0 ? (
              <div aria-labelledby="locked-badges-heading">
                <h3 id="locked-badges-heading">Still to earn</h3>
                <ul className="profile-sheet__log">
                  {lockedModules.map((module) => (
                    <li key={module.moduleId} style={{ overflowWrap: "anywhere" }}>
                      <img src="/assets/path-book-pixel.png" alt="" />
                      <span>
                        {module.title}: {module.completedCount}/{module.totalCount}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <aside className="profile-sheet__side" aria-label="Status and settings">
            <section className="profile-sheet__panel" aria-labelledby="activity-heading">
              <h2 id="activity-heading">Adventure Log</h2>
              <ul className="profile-sheet__log">
                {newestBadge ? (
                  <li>
                    <img src="/assets/ui/hud/agimat-sun.png" alt="" />
                    <span>Badge earned: {newestBadge.title}</span>
                  </li>
                ) : null}
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

            <section className="profile-sheet__panel" aria-labelledby="achievements-heading">
              <h2 id="achievements-heading">Achievements</h2>
              <ul className="profile-sheet__log">
                {stats.achievements.map((achievement) => (
                  <li
                    key={achievement.id}
                    data-achievement-id={achievement.id}
                    style={{ opacity: achievement.unlocked ? 1 : 0.45 }}
                  >
                    <img src="/assets/ui/hud/agimat-sun.png" alt="" />
                    <span>
                      {achievement.title}
                      {achievement.unlocked && achievement.earnedAt
                        ? ` · ${formatEarned(achievement.earnedAt)}`
                        : " · Locked"}
                    </span>
                  </li>
                ))}
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
            <Link href="/" className="profile-sheet__wood-button">School sign-in</Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
