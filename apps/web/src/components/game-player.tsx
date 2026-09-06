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
import { hintFor, labelFor } from "@/lib/game-copy";
import {
  ApiError,
  evaluateAttempt,
  finishAttempt,
  recordMiss,
} from "@/lib/path-api";
import {
  HEARTS_EMPTY_CODE,
  firstTryScore,
  pieceCount,
  type AssessmentGame,
  type AttemptEvent,
  type AttemptInfo,
  type FinishAnswers,
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
  answers: FinishAnswers;
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
  accountId: string,
  levelId: string,
  revision: string,
): AttemptDraft | null {
  if (typeof window === "undefined") return null;
  const draft = readAttemptDraft({ accountId, levelId, revision });
  if (!draft || draft.status === "saved") return null;
  return draft;
}

export function GamePlayer({
  levelId,
  moduleId,
  title,
  game,
  attempt,
  accountId,
  hearts: startHearts,
}: {
  levelId: string;
  moduleId: string;
  title: string;
  game: AssessmentGame;
  attempt: AttemptInfo;
  accountId: string;
  hearts: number;
}) {
  const router = useRouter();
  const revision = attempt.contentRevision || gameContentRevision(game as unknown as GameContent);
  const [hearts, setHearts] = useState(startHearts);
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [empty, setEmpty] = useState(startHearts <= 0);
  const pendingEmpty = useRef(false);
  const [resume] = useState(() => readResumeDraft(accountId, levelId, revision));
  const [result, setResult] = useState<ScoredResult | null>(null);
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
  const [attemptId, setAttemptId] = useState(attempt.id);
  const pendingAnswers = useRef<FinishAnswers | null>(
    resume && typeof sessionStorage !== "undefined"
      ? readPendingAnswers(accountId, levelId, revision)
      : null,
  );

  function persistDraft(scored: ScoredResult, status: AttemptDraft["status"]): void {
    writeAttemptDraft({
      accountId,
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
    writePendingAnswers(accountId, levelId, revision, scored.answers);
  }

  async function reconcileSave(scored: ScoredResult): Promise<void> {
    setBusy(true);
    setError(null);
    setSavePhase("saving");
    persistDraft(scored, "saving");
    try {
      const finished = await finishAttempt(attemptId, {
        answers: scored.answers,
        clientAttemptId: scored.clientAttemptId,
      });
      const next = {
        ...scored,
        score: finished.score,
        maxScore: finished.maxScore,
        stars: finished.stars,
      };
      setResult(next);
      setSavePhase("saved");
      persistDraft(next, "saved");
      clearAttemptDraft({ accountId, levelId, revision });
      clearPendingAnswers(accountId, levelId, revision);
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
      const parsed = await recordMiss(levelId, newClientAttemptId());
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

  async function onEvaluate(event: AttemptEvent) {
    return evaluateAttempt(attemptId, event);
  }

  async function onFinish(
    _score: number,
    _max: number,
    misses: number,
    answers?: FinishAnswers,
  ) {
    if (!answers) {
      setError("Missing answers for assessment finish");
      return;
    }
    const scored: ScoredResult = {
      score: 0,
      maxScore: 0,
      stars: 1,
      misses,
      clientAttemptId: resume?.clientAttemptId ?? newClientAttemptId(),
      answers,
    };
    setResult(scored);
    setSavePhase("completed-locally");
    persistDraft(scored, "completed-locally");
    await reconcileSave(scored);
  }

  if (empty) {
    return <HeartsBreak moduleId={moduleId} />;
  }

  if ((result || (resume && pendingAnswers.current)) && savePhase !== "playing") {
    const scored =
      result ??
      (resume && pendingAnswers.current
        ? {
            score: resume.score,
            maxScore: resume.maxScore,
            stars: resume.stars,
            misses: resume.misses,
            clientAttemptId: resume.clientAttemptId,
            answers: pendingAnswers.current,
          }
        : null);
    if (scored) {
      const unsaved = isUnsavedSavePhase(savePhase);
      return (
        <StarCelebration
          title={title}
          score={scored.score}
          maxScore={scored.maxScore}
          stars={scored.stars}
          error={error}
          statusLabel={statusLabelFor(savePhase)}
          onRetrySave={
            unsaved && !busy
              ? () => {
                  void reconcileSave(scored);
                }
              : undefined
          }
          onPlayAgain={() => {
            clearAttemptDraft({ accountId, levelId, revision });
            clearPendingAnswers(accountId, levelId, revision);
            setResult(null);
            setSavePhase("playing");
            setError(null);
            setNonce((n) => n + 1);
            router.refresh();
            setAttemptId(attempt.id);
          }}
          onContinue={() => {
            router.push(`/learn/${moduleId}`);
            router.refresh();
          }}
        />
      );
    }
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
          onEvaluate={onEvaluate}
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
  onEvaluate,
  onHeartsEmpty,
  onChange,
}: {
  game: GameContent | AssessmentGame;
  mode?: "play" | "build";
  disabled?: boolean;
  onMiss?: (
    why: WhyPayload | null,
    opts?: { hold?: boolean },
  ) => Promise<"ok" | "empty" | "unsynced">;
  onFinish?: (
    score: number,
    maxScore: number,
    misses: number,
    answers?: FinishAnswers,
  ) => void;
  onEvaluate?: (event: AttemptEvent) => Promise<import("@jose/shared").EvaluateEventResult>;
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
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "quiz" }>) => void) | undefined}
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
          onEvaluate={onEvaluate}
          onHeartsEmpty={onHeartsEmpty}
          onChange={onChange as ((g: Extract<GameContent, { type: "memory" }>) => void) | undefined}
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
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "timeline" }>) => void) | undefined}
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
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "blank" }>) => void) | undefined}
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
          onEvaluate={onEvaluate}
          onChange={onChange as ((g: Extract<GameContent, { type: "sort" }>) => void) | undefined}
        />
      );
  }
}

/** Practice / playtest helper — local scoring only, never writes grades. */
export function localPracticeFinish(
  game: GameContent,
  misses: number,
): { score: number; maxScore: number; stars: 1 | 2 | 3 } {
  return firstTryScore(pieceCount(game), misses);
}

const ANSWERS_KEY = "jose.attemptAnswers";

function answersStoreKey(accountId: string, levelId: string, revision: string) {
  return `${accountId}::${levelId}::${revision}`;
}

function readPendingAnswers(
  accountId: string,
  levelId: string,
  revision: string,
): FinishAnswers | null {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, FinishAnswers>;
    return parsed[answersStoreKey(accountId, levelId, revision)] ?? null;
  } catch {
    return null;
  }
}

function writePendingAnswers(
  accountId: string,
  levelId: string,
  revision: string,
  answers: FinishAnswers,
) {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, FinishAnswers>) : {};
    parsed[answersStoreKey(accountId, levelId, revision)] = answers;
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function clearPendingAnswers(accountId: string, levelId: string, revision: string) {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, FinishAnswers>;
    delete parsed[answersStoreKey(accountId, levelId, revision)];
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}
