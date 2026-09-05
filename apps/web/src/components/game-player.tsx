"use client";

import {
  clearAttemptDraft,
  gameContentRevision,
  isUnsavedSavePhase,
  newClientAttemptId,
  readAttemptDraft,
  writeAttemptDraft,
  type AttemptDraft,
  type SavePhase,
} from "@/lib/attempt-draft";
import { requireClientAccountId } from "@/lib/client-account";
import { hintFor, labelFor } from "@/lib/game-copy";
import { ApiError, recordMiss, submitAttempt } from "@/lib/path-api";
import {
  HEARTS_EMPTY_CODE,
  firstTryScore,
  pieceCount,
  type GameContent,
} from "@jose/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BlankGame } from "./games/blank-game";
import {
  GameFrame,
  HeartsBreak,
  StarCelebration,
  WhySheet,
} from "./games/game-stage";
import { MemoryGame } from "./games/memory-game";
import type { WhyPayload } from "./games/play-types";
import { QuizGame } from "./games/quiz-game";
import { SortGame } from "./games/sort-game";
import { TimelineGame } from "./games/timeline-game";

type ScoredResult = {
  score: number;
  maxScore: number;
  stars: number;
  misses: number;
  clientAttemptId: string;
};

function statusLabelFor(phase: SavePhase): string | null {
  switch (phase) {
    case "completed-locally":
      return "Finished — saving your result…";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "save-failed":
      return "Result not saved yet";
    default:
      return null;
  }
}

function readResumeDraft(
  levelId: string,
  revision: string,
): AttemptDraft | null {
  if (typeof window === "undefined") return null;
  const accountId = requireClientAccountId();
  const draft = readAttemptDraft({ accountId, levelId, revision });
  if (!draft || draft.status === "saved") return null;
  return draft;
}

export function GamePlayer({
  levelId,
  moduleId,
  title,
  game,
  hearts: startHearts,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  game: GameContent;
  hearts: number;
}) {
  const router = useRouter();
  const revision = gameContentRevision(game);
  const [hearts, setHearts] = useState(startHearts);
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [empty, setEmpty] = useState(startHearts <= 0);
  const pendingEmpty = useRef(false);
  const [resume] = useState(() => readResumeDraft(levelId, revision));
  const [result, setResult] = useState<ScoredResult | null>(() =>
    resume
      ? {
          score: resume.score,
          maxScore: resume.maxScore,
          stars: resume.stars,
          misses: resume.misses,
          clientAttemptId: resume.clientAttemptId,
        }
      : null,
  );
  const [savePhase, setSavePhase] = useState<SavePhase>(() => {
    if (!resume) return "playing";
    return resume.status === "saving" ? "save-failed" : resume.status;
  });
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    resume
      ? "Your result was kept on this device. Retry saving when you are back online."
      : null,
  );

  function persistDraft(
    scored: ScoredResult,
    status: AttemptDraft["status"],
  ): void {
    writeAttemptDraft({
      accountId: requireClientAccountId(),
      levelId,
      moduleId,
      title,
      revision,
      clientAttemptId: scored.clientAttemptId,
      score: scored.score,
      maxScore: scored.maxScore,
      stars: scored.stars,
      misses: scored.misses,
      status,
      updatedAt: Date.now(),
    });
  }

  async function reconcileSave(scored: ScoredResult): Promise<void> {
    setBusy(true);
    setError(null);
    setSavePhase("saving");
    persistDraft(scored, "saving");
    try {
      await submitAttempt(levelId, {
        score: scored.score,
        maxScore: scored.maxScore,
        clientAttemptId: scored.clientAttemptId,
        payload: { misses: scored.misses, stars: scored.stars },
      });
      setSavePhase("saved");
      persistDraft(scored, "saved");
      clearAttemptDraft({
        accountId: requireClientAccountId(),
        levelId,
        revision,
      });
    } catch (err) {
      setSavePhase("save-failed");
      persistDraft(scored, "save-failed");
      setError(
        err instanceof Error
          ? `Not saved: ${err.message}`
          : "Not saved. Your local result is still here.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onMiss(
    payload: WhyPayload | null,
    opts?: { hold?: boolean },
  ): Promise<"ok" | "empty" | "unsynced"> {
    setBusy(true);
    setError(null);
    try {
      const parsed = await recordMiss(levelId);
      setHearts(parsed.learner.hearts);
      if (payload) setWhy(payload);
      if (parsed.learner.hearts <= 0) {
        if (payload) pendingEmpty.current = true;
        else if (!opts?.hold) setEmpty(true);
        return "empty";
      }
      return "ok";
    } catch (err) {
      if (err instanceof ApiError && err.code === HEARTS_EMPTY_CODE) {
        setHearts(0);
        if (payload) {
          setWhy(payload);
          pendingEmpty.current = true;
        } else if (!opts?.hold) {
          setEmpty(true);
        }
        return "empty";
      }
      setError(
        err instanceof Error
          ? `Miss was not saved: ${err.message}`
          : "Miss was not saved. It is not synced yet.",
      );
      if (payload) setWhy(payload);
      return "unsynced";
    } finally {
      setBusy(false);
    }
  }

  async function onFinish(_score: number, _max: number, misses: number) {
    const scoredBase = firstTryScore(pieceCount(game), misses);
    const scored: ScoredResult = {
      ...scoredBase,
      misses,
      clientAttemptId: newClientAttemptId(),
    };
    setResult(scored);
    setSavePhase("completed-locally");
    persistDraft(scored, "completed-locally");
    await reconcileSave(scored);
  }

  if (empty) {
    return <HeartsBreak moduleId={moduleId} />;
  }

  if (result && savePhase !== "playing") {
    const unsaved = isUnsavedSavePhase(savePhase);
    return (
      <StarCelebration
        title={title}
        score={result.score}
        maxScore={result.maxScore}
        stars={result.stars}
        error={error}
        statusLabel={statusLabelFor(savePhase)}
        onRetrySave={
          unsaved && !busy
            ? () => {
                void reconcileSave(result);
              }
            : undefined
        }
        onPlayAgain={() => {
          clearAttemptDraft({
            accountId: requireClientAccountId(),
            levelId,
            revision,
          });
          setResult(null);
          setSavePhase("playing");
          setError(null);
          setNonce((n) => n + 1);
        }}
        onContinue={() => {
          router.push(`/learn/${moduleId}`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <GameFrame
        title={title}
        hint={hintFor(game.type)}
        hearts={hearts}
        showHearts
        progress={labelFor(game.type)}
        wide={game.type === "timeline"}
      >
        {error ? (
          <p className="mb-4 text-sm font-bold text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        <GameSwitch
          key={nonce}
          game={game}
          disabled={busy || Boolean(why)}
          onMiss={onMiss}
          onFinish={onFinish}
          onHeartsEmpty={() => setEmpty(true)}
        />
      </GameFrame>
      {why ? (
        <WhySheet
          why={why}
          onDismiss={() => {
            setWhy(null);
            if (pendingEmpty.current) {
              pendingEmpty.current = false;
              setEmpty(true);
            }
          }}
        />
      ) : null}
    </>
  );
}

export function GameSwitch({
  game,
  mode = "play",
  disabled,
  onMiss,
  onFinish,
  onHeartsEmpty,
  onChange,
}: {
  game: GameContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onMiss?: (
    why: WhyPayload | null,
    opts?: { hold?: boolean },
  ) => Promise<"ok" | "empty" | "unsynced">;
  onFinish?: (score: number, maxScore: number, misses: number) => void;
  onHeartsEmpty?: () => void;
  onChange?: (game: GameContent) => void;
}) {
  switch (game.type) {
    case "quiz":
      return (
        <QuizGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onChange={onChange as ((g: typeof game) => void) | undefined}
        />
      );
    case "memory":
      return (
        <MemoryGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onHeartsEmpty={onHeartsEmpty}
          onChange={onChange as ((g: typeof game) => void) | undefined}
        />
      );
    case "timeline":
      return (
        <TimelineGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onChange={onChange as ((g: typeof game) => void) | undefined}
        />
      );
    case "blank":
      return (
        <BlankGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onChange={onChange as ((g: typeof game) => void) | undefined}
        />
      );
    case "sort":
      return (
        <SortGame
          game={game}
          mode={mode}
          disabled={Boolean(disabled)}
          onMiss={onMiss}
          onFinish={onFinish}
          onChange={onChange as ((g: typeof game) => void) | undefined}
        />
      );
  }
}
