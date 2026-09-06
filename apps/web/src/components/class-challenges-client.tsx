"use client";

import { ClassChallengeBoard } from "@/components/class-challenge-board";
import {
  ApiError,
  contributeToChallenge,
  fetchMyChallenges,
  fetchStudentChallenge,
  joinClassWithInvite,
  optInToChallenge,
  patchChallengeParticipation,
} from "@/lib/path-api";
import type {
  ChallengeDisplayMode,
  StudentChallengeListItem,
  StudentChallengeView,
} from "@jose/shared";
import { useState } from "react";

export function ClassChallengesClient({
  initial,
  initialError,
}: {
  initial: StudentChallengeListItem[];
  initialError: string | null;
}) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<StudentChallengeView | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [joining, setJoining] = useState(false);

  async function reloadList() {
    const next = await fetchMyChallenges();
    setItems(next);
  }

  return (
    <ClassChallengeBoard
      items={items}
      selected={selected}
      error={error}
      joining={joining}
      onJoinClass={(inviteCode) => {
        void (async () => {
          setJoining(true);
          setError(null);
          try {
            await joinClassWithInvite(inviteCode);
            await reloadList();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not join class");
          } finally {
            setJoining(false);
          }
        })();
      }}
      onSelect={(id) => {
        void (async () => {
          setError(null);
          try {
            setSelected(await fetchStudentChallenge(id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not load challenge");
          }
        })();
      }}
      onOptIn={(id, displayMode: ChallengeDisplayMode) => {
        void (async () => {
          setError(null);
          try {
            setSelected(await optInToChallenge(id, displayMode));
            await reloadList();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Opt-in failed");
          }
        })();
      }}
      onContribute={(id, input) => {
        void (async () => {
          setError(null);
          try {
            setSelected(await contributeToChallenge(id, input));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add source");
          }
        })();
      }}
      onSetDisplayMode={(id, displayMode) => {
        void (async () => {
          setError(null);
          try {
            setSelected(await patchChallengeParticipation(id, displayMode));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update display");
          }
        })();
      }}
    />
  );
}
