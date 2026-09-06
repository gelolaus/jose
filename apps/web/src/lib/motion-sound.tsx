"use client";

import { feedbackHoldMs, type MotionCue } from "@jose/shared";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const SOUND_KEY = "jose.sound.muted";
const FOCUS_KEY = "jose.focusMode";

function subscribeMedia(query: string, onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function mediaMatches(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeMedia("(prefers-reduced-motion: reduce)", onChange),
    () => mediaMatches("(prefers-reduced-motion: reduce)"),
    () => false,
  );
}

function readFlag(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

const soundListeners = new Set<() => void>();
let soundMuted = false;

function emitSound() {
  for (const listener of soundListeners) listener();
}

export function useSoundMuted(): [boolean, (muted: boolean) => void] {
  const muted = useSyncExternalStore(
    (onChange) => {
      soundListeners.add(onChange);
      return () => soundListeners.delete(onChange);
    },
    () => soundMuted,
    () => false,
  );

  useEffect(() => {
    soundMuted = readFlag(SOUND_KEY, false);
    emitSound();
  }, []);

  function setMuted(next: boolean) {
    soundMuted = next;
    writeFlag(SOUND_KEY, next);
    emitSound();
  }

  return [muted, setMuted];
}

const focusListeners = new Set<() => void>();
let focusMode = false;

function emitFocus() {
  for (const listener of focusListeners) listener();
}

export function useFocusMode(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (onChange) => {
      focusListeners.add(onChange);
      return () => focusListeners.delete(onChange);
    },
    () => focusMode,
    () => false,
  );

  useEffect(() => {
    focusMode = readFlag(FOCUS_KEY, false);
    emitFocus();
  }, []);

  function setFocus(next: boolean) {
    focusMode = next;
    writeFlag(FOCUS_KEY, next);
    emitFocus();
  }

  return [on, setFocus];
}

/** Soft WebAudio cues — opt-in via unmuted preference; silent when muted/Focus/reduced. */
export function useMotionSound() {
  const reducedMotion = usePrefersReducedMotion();
  const [muted] = useSoundMuted();
  const [focus] = useFocusMode();
  const ctxRef = useRef<AudioContext | null>(null);
  const generationRef = useRef(0);
  const prefsRef = useRef({ muted, focus, reducedMotion });

  useEffect(() => {
    prefsRef.current = { muted, focus, reducedMotion };
  }, [muted, focus, reducedMotion]);

  const cancelStale = useCallback(() => {
    generationRef.current += 1;
  }, []);

  useEffect(() => () => cancelStale(), [cancelStale]);

  const playCue = useCallback((cue: MotionCue) => {
    const prefs = prefsRef.current;
    if (prefs.muted || prefs.focus || prefs.reducedMotion) return;
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctxRef.current) ctxRef.current = new AudioCtx();
    const ctx = ctxRef.current;
    const generation = generationRef.current;
    void ctx.resume().then(() => {
      if (generation !== generationRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      const freqs: Record<MotionCue, number> = {
        select: 520,
        accept: 660,
        reject: 220,
        match: 740,
        unlock: 880,
        artifact: 990,
        progress: 600,
        milestone: 520,
      };
      osc.frequency.value = freqs[cue];
      osc.type = cue === "reject" ? "triangle" : "sine";
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.14);
    });
  }, []);

  return {
    reducedMotion,
    muted,
    focus,
    playCue,
    cancelStale,
    feedbackHoldMs: feedbackHoldMs(reducedMotion || focus),
  };
}

export function SoundFocusControls({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useSoundMuted();
  const [focus, setFocus] = useFocusMode();
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        aria-pressed={muted}
        onClick={() => setMuted(!muted)}
        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
      >
        {muted ? "Sound off" : "Sound on"}
      </button>
      <button
        type="button"
        aria-pressed={focus}
        onClick={() => setFocus(!focus)}
        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
      >
        {focus ? "Focus on" : "Focus off"}
      </button>
    </div>
  );
}
