"use client";

import {
  JOURNAL_CHANGE_EVENT,
  emptyJournal,
  journalOwnerKey,
  journalStorageKey,
  parseJournalStore,
} from "@/lib/journal-store";
import { useJoseSession } from "@/lib/use-jose-session";
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

function getServerSnapshot() {
  return null;
}

export function useJournalStore(): {
  ownerKey: string | null;
  store: JournalStore;
  ready: boolean;
} {
  const { learner, user, loading, authenticated } = useJoseSession();
  const accountId = learner?.id ?? user?.id ?? null;
  const ownerKey = accountId ? journalOwnerKey(accountId) : null;
  const raw = useSyncExternalStore(
    subscribe,
    () =>
      ownerKey && typeof window !== "undefined"
        ? window.localStorage.getItem(journalStorageKey(ownerKey))
        : null,
    getServerSnapshot,
  );
  if (loading) {
    return { ownerKey, store: emptyJournal(ownerKey ?? "account:pending"), ready: false };
  }
  if (!authenticated || !ownerKey) {
    return { ownerKey: null, store: emptyJournal("account:signed-out"), ready: true };
  }
  if (!raw) return { ownerKey, store: emptyJournal(ownerKey), ready: true };
  try {
    const parsed = parseJournalStore(JSON.parse(raw) as unknown);
    if (!parsed || parsed.ownerKey !== ownerKey) {
      return { ownerKey, store: emptyJournal(ownerKey), ready: true };
    }
    return { ownerKey, store: parsed, ready: true };
  } catch {
    return { ownerKey, store: emptyJournal(ownerKey), ready: true };
  }
}
