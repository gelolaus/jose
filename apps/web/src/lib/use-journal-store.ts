"use client";

import {
  JOURNAL_CHANGE_EVENT,
  JOURNAL_STORAGE_KEY,
  journalOwnerKey,
  parseJournalStore,
  emptyJournal,
} from "@/lib/journal-store";
import { useExplorerIdentity } from "@/lib/use-explorer-identity";
import type { JournalStore } from "@jose/shared";
import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(JOURNAL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(JOURNAL_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(JOURNAL_STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function useJournalStore(): { ownerKey: string; store: JournalStore } {
  const identity = useExplorerIdentity();
  const ownerKey = journalOwnerKey(identity.displayName);
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return { ownerKey, store: emptyJournal(ownerKey) };
  try {
    const parsed = parseJournalStore(JSON.parse(raw) as unknown);
    if (!parsed || parsed.ownerKey !== ownerKey) {
      return { ownerKey, store: emptyJournal(ownerKey) };
    }
    return { ownerKey, store: parsed };
  } catch {
    return { ownerKey, store: emptyJournal(ownerKey) };
  }
}
