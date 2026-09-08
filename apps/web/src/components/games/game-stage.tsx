"use client";

import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SoundFocusControls, useFocusMode, useMotionSound } from "@/lib/motion-sound";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { GameContent } from "@jose/shared";
import type { WhyPayload } from "./play-types";

export function HeartsHud({ hearts, max = 5 }: { hearts: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < hearts;
        return (
          <Heart
            key={i}
            className={`size-5 sm:size-6 ${on ? "fill-rose-500 text-rose-500" : "text-rose-200"}`}
            strokeWidth={2.4}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

export function WhySheet({
  why,
  onDismiss,
}: {
  why: WhyPayload;
  onDismiss: () => void;
}) {
  const { feedbackHoldMs, cancelStale, playCue } = useMotionSound();
  const [ready, setReady] = useState(feedbackHoldMs === 0);
  const readyRef = useRef(feedbackHoldMs === 0);
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  useFocusTrap(true, dialogRef, true);

  useEffect(() => {
    dialogRef.current?.focus();
    const generation = ++generationRef.current;
    playCue(why.tone === "success" ? "accept" : why.tone === "explain" ? "progress" : "reject");
    if (feedbackHoldMs === 0) {
      readyRef.current = true;
      return () => cancelStale();
    }
    const t = window.setTimeout(() => {
      if (generation !== generationRef.current) return;
      readyRef.current = true;
      setReady(true);
    }, feedbackHoldMs);
    return () => {
      window.clearTimeout(t);
      cancelStale();
    };
  }, [why, feedbackHoldMs, cancelStale, playCue]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && readyRef.current) onDismiss();
  }

  const eyebrow =
    why.tone === "success" ? "Why this works" : why.tone === "explain" ? "Take a look" : "Not quite";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/35 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="why-pop motion-screen w-full max-w-md rounded-[1.75rem] bg-[var(--jose-surface-elevated)] p-5 text-[var(--jose-text)] shadow-xl outline-none ring-2 ring-amber-400 sm:p-6"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-600">
          {eyebrow}
        </p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold text-[var(--jose-text)]">
          {why.title}
        </h2>
        <p id={bodyId} className="mt-2 whitespace-pre-line text-base font-semibold leading-relaxed text-[var(--jose-text)]">
          {why.body}
        </p>
        {why.sourceLabel ? (
          <p className="mt-3 text-sm font-bold text-[var(--jose-text-muted)]">
            Source:{" "}
            {why.sourceHref ? (
              <a href={why.sourceHref} className="text-violet-700 underline" target="_blank" rel="noreferrer">
                {why.sourceLabel}
              </a>
            ) : (
              why.sourceLabel
            )}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!ready}
          onClick={onDismiss}
          className="mt-5 min-h-11 w-full rounded-full bg-violet-700 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)]"
        >
          {ready ? "Got it" : "…"}
        </button>
      </div>
    </div>
  );
}

export function StarCelebration({
  title,
  score,
  maxScore,
  stars,
  error,
  statusLabel,
  onRetry,
  onRetrySave,
  onPlayAgain,
  onContinue,
  retryLabel = "Retry",
  retrySaveLabel = "Retry saving",
  playAgainLabel = "Play again",
  continueLabel = "Continue",
}: {
  title: string;
  score: number;
  maxScore: number;
  stars: number;
  error?: string | null;
  statusLabel?: string | null;
  onRetry?: () => void;
  onRetrySave?: () => void;
  onPlayAgain?: () => void;
  onContinue: () => void;
  retryLabel?: string;
  retrySaveLabel?: string;
  playAgainLabel?: string;
  continueLabel?: string;
}) {
  const playAgain = onPlayAgain ?? onRetry;
  const { playCue, cancelStale, reducedMotion } = useMotionSound();
  useEffect(() => {
    playCue("milestone");
    return () => cancelStale();
  }, [playCue, cancelStale]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <Star
            key={n}
            className={`size-12 sm:size-14 ${
              n <= stars ? "fill-amber-400 text-amber-400" : "text-slate-200"
            } ${reducedMotion ? "" : "star-pop"}`}
            strokeWidth={2.2}
            style={reducedMotion ? undefined : { animationDelay: `${n * 80}ms` }}
            aria-hidden
          />
        ))}
      </div>
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-500">
        {stars === 3 ? "Perfect" : stars === 2 ? "Nice work" : "You finished"}
      </p>
      <p className="font-display text-5xl font-semibold text-[var(--jose-text)]">
        {score}
        <span className="text-2xl text-[var(--jose-text-muted)]">/{maxScore}</span>
      </p>
      <p className="text-base font-semibold text-[var(--jose-text)]">{title}</p>
      {statusLabel ? (
        <p className="text-sm font-extrabold text-[var(--jose-text-muted)]" aria-live="polite">
          {statusLabel}
        </p>
      ) : null}
      {error ? <p className="text-sm font-bold text-rose-600" role="alert">{error}</p> : null}
      <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onRetrySave ? (
          <button
            type="button"
            onClick={onRetrySave}
            className="flex-1 rounded-full bg-amber-500 px-5 py-3 text-sm font-extrabold text-white shadow-md"
          >
            {retrySaveLabel}
          </button>
        ) : null}
        {playAgain ? (
          <button
            type="button"
            onClick={playAgain}
            className="flex-1 rounded-full bg-[var(--jose-surface-control)] px-5 py-3 text-sm font-extrabold text-[var(--jose-text)]"
          >
            {onPlayAgain ? playAgainLabel : retryLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 rounded-full bg-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-md"
        >
          {continueLabel}
        </button>
      </div>
      <SoundFocusControls className="mt-2 justify-center" />
    </div>
  );
}

export function HeartsBreak({
  moduleId,
}: {
  moduleId: string;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Heart className="size-16 fill-rose-200 text-rose-300" strokeWidth={2} aria-hidden />
      <p className="font-display text-3xl font-semibold text-[var(--jose-text)]">Take a break</p>
      <p className="text-base font-semibold text-[var(--jose-text)]">
        Out of arcade challenge lives. Core learning and required coursework stay
        open — continue a lesson, use Practice, or wait for challenge lives to refill.
      </p>
      <Link
        href={`/learn/${moduleId}`}
        className="mt-2 w-full rounded-full bg-violet-600 px-5 py-3 text-center text-sm font-extrabold text-white shadow-md"
      >
        Back to the path
      </Link>
      <Link
        href="/learn"
        className="w-full rounded-full bg-[var(--jose-surface-control)] px-5 py-3 text-center text-sm font-extrabold text-[var(--jose-text)]"
      >
        All modules
      </Link>
    </div>
  );
}

export function GameFrame({
  title,
  hint,
  hearts,
  progress,
  showHearts,
  wide,
  scene,
  children,
}: {
  title: string;
  hint: string;
  hearts?: number;
  progress?: string;
  showHearts?: boolean;
  wide?: boolean;
  scene?: GameContent["type"];
  children: ReactNode;
}) {
  const [focus] = useFocusMode();
  return (
    <div
      data-game-stage={scene}
      className={`game-stage mx-auto w-full px-4 py-3 sm:px-6 sm:py-8 ${wide ? "max-w-5xl" : "max-w-3xl"} ${
        scene ? `game-stage--${scene}` : ""
      } ${focus ? "jose-focus" : ""}`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3 sm:mb-5">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-[var(--jose-text)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--jose-text)] sm:mt-1 sm:text-base">
            {hint}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {showHearts && hearts !== undefined ? <HeartsHud hearts={hearts} /> : null}
          {progress ? (
            <p className="hidden text-xs font-extrabold uppercase tracking-wide text-[var(--jose-accent)] sm:block">
              {progress}
            </p>
          ) : null}
          <SoundFocusControls />
        </div>
      </div>
      {children}
    </div>
  );
}
