"use client";

import {
  EXPLORER_STORAGE_KEY,
  defaultExplorerIdentity,
  parseExplorerIdentity,
  type ExplorerIdentity,
} from "./explorer-identity";
import { useSyncExternalStore } from "react";

const EXPLORER_CHANGE_EVENT = "jose:explorer-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EXPLORER_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EXPLORER_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(EXPLORER_STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function notifyExplorerIdentityChanged() {
  window.dispatchEvent(new Event(EXPLORER_CHANGE_EVENT));
}

export function useExplorerIdentity(displayName?: string): ExplorerIdentity {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return defaultExplorerIdentity(displayName);
  try {
    return (
      parseExplorerIdentity(JSON.parse(raw) as unknown) ??
      defaultExplorerIdentity(displayName)
    );
  } catch {
    return defaultExplorerIdentity(displayName);
  }
}
