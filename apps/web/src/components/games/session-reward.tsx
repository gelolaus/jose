export type SessionReward = {
  badgeTitle: string | null;
  xp: number | null;
  streak: number | null;
};

const EMPTY_REWARD: SessionReward = { badgeTitle: null, xp: null, streak: null };

/**
 * Read completion fields that may not be on the shared schema yet.
 * Missing or empty values are skipped so the screen finishes as it does today.
 */
export function readSessionReward(result: object): SessionReward {
  const raw = result as {
    moduleBadge?: { title?: unknown } | null;
    xpAwarded?: unknown;
    streakIncreased?: unknown;
    learner?: { streak?: unknown };
  };
  const title =
    raw.moduleBadge && typeof raw.moduleBadge === "object" ? raw.moduleBadge.title : null;
  const badgeTitle = typeof title === "string" && title.trim() ? title.trim() : null;
  const xp =
    typeof raw.xpAwarded === "number" && Number.isFinite(raw.xpAwarded) && raw.xpAwarded > 0
      ? raw.xpAwarded
      : null;
  const streak =
    raw.streakIncreased === true && typeof raw.learner?.streak === "number"
      ? raw.learner.streak
      : null;
  return { badgeTitle, xp, streak };
}

export function hasSessionReward(reward: SessionReward | null | undefined): boolean {
  return Boolean(reward && (reward.badgeTitle || reward.xp != null || reward.streak != null));
}

export function SessionRewardBeat({ reward }: { reward: SessionReward | null | undefined }) {
  const shown = reward ?? EMPTY_REWARD;
  if (!hasSessionReward(shown)) return null;
  return (
    <div className="session-reward" role="status">
      {shown.badgeTitle ? (
        <p>
          <span className="session-reward__kicker">Module badge earned</span>
          <span className="session-reward__title">{shown.badgeTitle}</span>
        </p>
      ) : null}
      {shown.xp != null ? <p className="session-reward__xp">+{shown.xp} XP</p> : null}
      {shown.streak != null ? (
        <p className="session-reward__streak">{shown.streak} day streak</p>
      ) : null}
    </div>
  );
}
