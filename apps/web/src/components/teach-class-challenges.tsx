"use client";

import { TeachChallengesPanel } from "@/components/teach-challenges-panel";
import {
  assignTeachChallengeTeamMember,
  createTeachChallenge,
  createTeachChallengeTeam,
  fetchTeachChallenge,
  fetchTeachChallenges,
  moderateTeachContribution,
  patchClassChallengeSettings,
} from "@/lib/path-api";
import type { TeacherChallengeSummary, TeacherChallengeView } from "@jose/shared";
import { useState } from "react";

export function TeachClassChallenges({
  classId,
  className,
  challengesEnabled,
  onEnabledChange,
  onError,
}: {
  classId: string;
  className: string;
  challengesEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onError: (message: string) => void;
}) {
  const [summaries, setSummaries] = useState<TeacherChallengeSummary[]>([]);
  const [detail, setDetail] = useState<TeacherChallengeView | null>(null);

  async function reload() {
    setSummaries(await fetchTeachChallenges(classId));
  }

  function report(err: unknown, fallback: string) {
    onError(err instanceof Error ? err.message : fallback);
  }

  return (
    <TeachChallengesPanel
      classId={classId}
      className={className}
      challengesEnabled={challengesEnabled}
      summaries={summaries}
      detail={detail}
      onToggleEnabled={(enabled) => {
        void (async () => {
          try {
            await patchClassChallengeSettings(classId, { challengesEnabled: enabled });
            onEnabledChange(enabled);
            if (enabled) {
              await reload();
            } else {
              setSummaries([]);
              setDetail(null);
            }
          } catch (err) {
            report(err, "Could not update setting");
          }
        })();
      }}
      onCreate={(input) => {
        void (async () => {
          try {
            const created = await createTeachChallenge(classId, input);
            setDetail(created);
            await reload();
          } catch (err) {
            report(err, "Could not create challenge");
          }
        })();
      }}
      onSelect={(challengeId) => {
        void (async () => {
          try {
            setDetail(await fetchTeachChallenge(classId, challengeId));
          } catch (err) {
            report(err, "Could not load challenge");
          }
        })();
      }}
      onCreateTeam={(challengeId, name) => {
        void (async () => {
          try {
            await createTeachChallengeTeam(classId, challengeId, name);
            setDetail(await fetchTeachChallenge(classId, challengeId));
          } catch (err) {
            report(err, "Could not add team");
          }
        })();
      }}
      onAssignMember={(challengeId, teamId, learnerId) => {
        void (async () => {
          try {
            await assignTeachChallengeTeamMember(classId, challengeId, teamId, learnerId);
            setDetail(await fetchTeachChallenge(classId, challengeId));
          } catch (err) {
            report(err, "Could not assign student");
          }
        })();
      }}
      onModerate={(challengeId, contributionId, status) => {
        void (async () => {
          try {
            setDetail(
              await moderateTeachContribution(classId, challengeId, contributionId, status),
            );
            await reload();
          } catch (err) {
            report(err, "Could not moderate");
          }
        })();
      }}
      onRefresh={() => {
        void reload().catch((err) => report(err, "Could not load challenges"));
      }}
    />
  );
}
