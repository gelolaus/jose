/**
 * Private student journal — local until account-scoped server storage exists.
 * Notes are keyed by the immutable logged-in account/learner ID, never display name.
 */

import {
  journalEntrySchema,
  journalExportSchema,
  journalStoreSchema,
  type JournalEntry,
  type JournalExport,
  type JournalStore,
  type JournalVisibility,
} from "@jose/shared";

export const JOURNAL_STORAGE_PREFIX = "jose.journal.v1";
/** Legacy single-blob key from the display-name prototype. Never reuse it. */
export const JOURNAL_LEGACY_STORAGE_KEY = "jose.journal.v1";
export const JOURNAL_CHANGE_EVENT = "jose:journal-change";

export function journalOwnerKey(accountId: string): string {
  const id = accountId.trim();
  if (!id) {
    throw new Error("Journal notes require a logged-in account ID");
  }
  return `account:${id}`;
}

export function journalStorageKey(ownerKey: string): string {
  return `${JOURNAL_STORAGE_PREFIX}:${ownerKey}`;
}

export function emptyJournal(ownerKey: string): JournalStore {
  return { version: 1, ownerKey, entries: [] };
}

export function parseJournalStore(raw: unknown): JournalStore | null {
  const parsed = journalStoreSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function isDisplayNameOwnerKey(ownerKey: string): boolean {
  return ownerKey.startsWith("local:");
}

export function readJournalStore(ownerKey: string): JournalStore {
  if (typeof window === "undefined") return emptyJournal(ownerKey);
  try {
    const scoped = window.localStorage.getItem(journalStorageKey(ownerKey));
    if (scoped) {
      const store = parseJournalStore(JSON.parse(scoped) as unknown);
      if (store && store.ownerKey === ownerKey && !isDisplayNameOwnerKey(store.ownerKey)) {
        return store;
      }
      return emptyJournal(ownerKey);
    }
    // Do not adopt legacy display-name blobs — they are not account-scoped.
    return emptyJournal(ownerKey);
  } catch {
    return emptyJournal(ownerKey);
  }
}

export function writeJournalStore(store: JournalStore): void {
  if (typeof window === "undefined") return;
  if (isDisplayNameOwnerKey(store.ownerKey)) {
    throw new Error("Journal notes must use an account ID, not a display name");
  }
  window.localStorage.setItem(journalStorageKey(store.ownerKey), JSON.stringify(store));
  window.dispatchEvent(new Event(JOURNAL_CHANGE_EVENT));
}

/**
 * Removes this account's journal from the device. Other accounts' keys stay.
 * Sign-out uses `clearSensitiveClientState`, which keeps `jose.journal.v1:account:*`
 * so a later sign-in with the same account ID still has notes.
 */
export function clearJournalForLogout(ownerKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(journalStorageKey(ownerKey));
  window.localStorage.removeItem(JOURNAL_LEGACY_STORAGE_KEY);
  window.dispatchEvent(new Event(JOURNAL_CHANGE_EVENT));
}

/**
 * When the signed-in account changes, drop the previous account's in-memory
 * binding. Notes for the previous account remain under their own storage key
 * until logout wipe / the owner signs in again.
 */
export function switchJournalAccount(
  previousOwnerKey: string | null,
  nextOwnerKey: string,
): JournalStore {
  void previousOwnerKey;
  return readJournalStore(nextOwnerKey);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertJournalEntry(
  ownerKey: string,
  partial: Omit<JournalEntry, "id" | "createdAt" | "updatedAt" | "visibility"> & {
    id?: string;
    visibility?: JournalVisibility;
  },
): JournalEntry {
  const store = readJournalStore(ownerKey);
  const now = Date.now();
  const existing = partial.id
    ? store.entries.find((e) => e.id === partial.id)
    : undefined;
  const entry = journalEntrySchema.parse({
    id: existing?.id ?? partial.id ?? newId(),
    kind: partial.kind,
    title: partial.title,
    body: partial.body ?? "",
    visibility: partial.visibility ?? existing?.visibility ?? "private",
    source: partial.source,
    termId: partial.termId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  const entries = existing
    ? store.entries.map((e) => (e.id === entry.id ? entry : e))
    : [entry, ...store.entries];
  writeJournalStore({ version: 1, ownerKey, entries });
  return entry;
}

export function removeJournalEntry(ownerKey: string, id: string): void {
  const store = readJournalStore(ownerKey);
  writeJournalStore({
    version: 1,
    ownerKey,
    entries: store.entries.filter((e) => e.id !== id),
  });
}

export function searchJournal(
  store: JournalStore,
  query: string,
): JournalEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return store.entries;
  return store.entries.filter((entry) => {
    const hay = `${entry.title} ${entry.body} ${entry.source?.levelTitle ?? ""} ${entry.source?.sectionTitle ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function exportJournalNotes(
  store: JournalStore,
  options: { includePrivate: boolean; includeTeacherSubmitted: boolean },
): JournalExport {
  const entries = store.entries.filter((entry) => {
    if (entry.visibility === "private") return options.includePrivate;
    if (entry.visibility === "teacher_submitted") {
      return options.includeTeacherSubmitted;
    }
    return false;
  });
  return journalExportSchema.parse({
    exportedAt: new Date().toISOString(),
    ownerKey: store.ownerKey,
    includePrivate: options.includePrivate,
    includeTeacherSubmitted: options.includeTeacherSubmitted,
    entries,
  });
}

export function downloadJournalExport(data: JournalExport, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
