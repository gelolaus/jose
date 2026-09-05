"use client";

import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const t = window.setTimeout(() => {
      readyRef.current = true;
      setReady(true);
    }, 650);
    return () => window.clearTimeout(t);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && readyRef.current) onDismiss();
  }

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
        className="why-pop w-full max-w-md rounded-[1.75rem] bg-white p-5 shadow-xl outline-none ring-2 ring-amber-200 sm:p-6"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-600">
          Not quite
        </p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold text-slate-800">
          {why.title}
        </h2>
        <p id={bodyId} className="mt-2 whitespace-pre-line text-base font-semibold leading-relaxed text-slate-600">
          {why.body}
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={onDismiss}
          className="mt-5 w-full rounded-full bg-violet-600 px-5 py-3.5 text-base font-extrabold text-white shadow-md disabled:opacity-50"
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
  onRetrySave,
  onPlayAgain,
  onContinue,
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
  onRetrySave?: () => void;
  onPlayAgain: () => void;
  onContinue: () => void;
  retrySaveLabel?: string;
  playAgainLabel?: string;
  continueLabel?: string;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <Star
            key={n}
            className={`star-pop size-12 sm:size-14 ${
              n <= stars ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
            strokeWidth={2.2}
            style={{ animationDelay: `${n * 80}ms` }}
            aria-hidden
          />
        ))}
      </div>
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-500">
        {stars === 3 ? "Perfect" : stars === 2 ? "Nice work" : "You finished"}
      </p>
      <p className="font-display text-5xl font-semibold text-slate-800">
        {score}
        <span className="text-2xl text-slate-400">/{maxScore}</span>
      </p>
      <p className="text-base font-semibold text-slate-600">{title}</p>
      {statusLabel ? (
        <p className="text-sm font-extrabold text-slate-500" aria-live="polite">
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
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 rounded-full bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-700"
        >
          {playAgainLabel}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 rounded-full bg-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-md"
        >
          {continueLabel}
        </button>
      </div>
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
      <p className="font-display text-3xl font-semibold text-slate-800">Take a break</p>
      <p className="text-base font-semibold text-slate-600">
        Out of hearts. Read a lesson to fill them, or wait — they come back slowly.
      </p>
      <Link
        href={`/learn/${moduleId}`}
        className="mt-2 w-full rounded-full bg-violet-600 px-5 py-3 text-center text-sm font-extrabold text-white shadow-md"
      >
        Back to the path
      </Link>
      <Link
        href="/learn"
        className="w-full rounded-full bg-slate-100 px-5 py-3 text-center text-sm font-extrabold text-slate-700"
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
  children,
}: {
  title: string;
  hint: string;
  hearts?: number;
  progress?: string;
  showHearts?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full px-4 py-3 sm:px-6 sm:py-8 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <div className="mb-2.5 flex items-start justify-between gap-3 sm:mb-5">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-slate-500 sm:mt-1 sm:text-sm">
            {hint}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {showHearts && hearts !== undefined ? <HeartsHud hearts={hearts} /> : null}
          {progress ? (
            <p className="hidden text-xs font-extrabold uppercase tracking-wide text-violet-500 sm:block">
              {progress}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
