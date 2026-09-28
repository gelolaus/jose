"use client";

import { completeLevel } from "@/lib/path-api";
import {
  hasSessionReward,
  readSessionReward,
  SessionRewardBeat,
  type SessionReward,
} from "@/components/games/session-reward";
import type { ChestContent } from "@jose/shared";
import { BookOpen, Gift, Map, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./session-play.css";

const KIND_ICON = {
  map: Map,
  excerpt: ScrollText,
  cover: BookOpen,
  illustration: Gift,
} as const;

export function ChestPlayer({
  levelId,
  moduleId,
  title,
  chest,
  nextLevelId,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  chest: ChestContent;
  nextLevelId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<SessionReward | null>(null);
  const Icon = KIND_ICON[chest.artifact.kind] ?? Gift;

  async function onCollect() {
    setBusy(true);
    setError(null);
    try {
      const result = await completeLevel(levelId);
      const earned = readSessionReward(result);
      setReward(hasSessionReward(earned) ? earned : null);
      setDuplicate(result.artifactAwarded === false);
      setOpened(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save artifact");
    } finally {
      setBusy(false);
    }
  }

  function onContinue() {
    router.push(
      nextLevelId ? `/learn/${moduleId}/${nextLevelId}` : `/learn/${moduleId}`,
    );
    router.refresh();
  }

  if (!opened) {
    return (
      <div className="session-play">
        <div className="session-play__scroll session-play__scroll--center">
          <div className="flex size-28 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-md">
            <Gift className="size-14" strokeWidth={2.2} aria-hidden />
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--jose-ink)]">
            {title}
          </h1>
          <p className="text-lg text-[var(--jose-ink-muted)]">{chest.message}</p>
          <p className="text-sm font-semibold text-[var(--jose-ink-muted)]">
            {chest.achievementCriteria}
          </p>
          {chest.artifact.approvalStatus === "draft" ? (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 ring-1 ring-amber-200">
              Draft artifact — a teacher should approve provenance before publishing
              this stop.
            </p>
          ) : null}
        </div>
        <div className="session-play__footer">
          {error ? (
            <p className="mb-2 text-sm font-semibold text-[#7a1a2e]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void onCollect()}
            disabled={busy}
            className="jose-button session-play__continue"
          >
            {busy ? "Saving…" : "Collect journal artifact"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-play">
      <div className="session-play__scroll">
      <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <Icon className="size-7" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Journal artifact · {chest.artifact.kind}
          </p>
          <h1 className="font-display text-3xl font-semibold text-[var(--jose-ink)]">
            {chest.artifact.title}
          </h1>
        </div>
      </div>
      <p className="text-base text-[var(--jose-ink-muted)]">{chest.artifact.summary}</p>
      {chest.artifact.body ? (
        <blockquote className="rounded-2xl bg-white px-4 py-4 text-sm leading-relaxed text-[var(--jose-ink)] ring-1 ring-[var(--jose-rule)]">
          {chest.artifact.body}
        </blockquote>
      ) : null}
      <p className="text-xs font-semibold text-[var(--jose-ink-muted)]">
        Provenance: {chest.artifact.provenance}
      </p>
      {chest.journalCoverId ? (
        <p className="rounded-2xl bg-[#f0e8f8] px-3 py-2 text-xs font-semibold text-[#0e0e24]">
          Cosmetic journal cover unlocked: {chest.journalCoverId} (no loot box,
          no paywall).
        </p>
      ) : null}
      {duplicate ? (
        <p className="text-sm font-semibold text-[var(--jose-ink-muted)]" role="status">
          You already collected this artifact. Repeat completion does not
          duplicate rewards.
        </p>
      ) : (
        <p className="text-sm font-semibold text-[#1a1a3e]" role="status">
          Saved to your journal. Revisit it anytime from Profile.
        </p>
      )}
      <SessionRewardBeat reward={reward} />
      </div>
      </div>
      <div className="session-play__footer">
        <button
          type="button"
          onClick={onContinue}
          className="jose-button session-play__continue"
        >
          {nextLevelId ? "Continue to next" : "Continue"}
        </button>
      </div>
    </div>
  );
}
