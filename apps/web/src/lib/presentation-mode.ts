"use client";

import { useSyncExternalStore, useEffect } from "react";

const KEY = "jose.presentation";
const CHANGE_EVENT = "jose:presentation-change";

export type PresentationMode = "adventure" | "focus";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): PresentationMode {
  try {
    return window.localStorage.getItem(KEY) === "focus" ? "focus" : "adventure";
  } catch {
    return "adventure";
  }
}

function getServerSnapshot(): PresentationMode {
  return "adventure";
}

export function writePresentationMode(mode: PresentationMode) {
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
  document.documentElement.dataset.presentation = mode;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePresentationMode(): PresentationMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function PresentationDocumentSync() {
  const mode = usePresentationMode();
  useEffect(() => {
    document.documentElement.dataset.presentation = mode;
  }, [mode]);
  return null;
}
