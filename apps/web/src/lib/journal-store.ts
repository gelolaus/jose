/**
 * Private student journal — local until account-scoped server storage exists.
 * Never POST private reflections to the shared demo learner API.
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

export const JOURNAL_STORAGE_KEY = "jose.journal.v1";
export const JOURNAL_CHANGE_EVENT = "jose:journal-change";

export function journalOwnerKey(displayName: string): string {
  return `local:${displayName.trim() || "Explorer"}`;
}

export function emptyJournal(ownerKey: string): JournalStore {
  return { version: 1, ownerKey, entries: [] };
}

export function parseJournalStore(raw: unknown): JournalStore | null {
  const parsed = journalStoreSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function readJournalStore(ownerKey: string): JournalStore {
  if (typeof window === "undefined") return emptyJournal(ownerKey);
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return emptyJournal(ownerKey);
    const store = parseJournalStore(JSON.parse(raw) as unknown);
    if (!store) return emptyJournal(ownerKey);
    if (store.ownerKey !== ownerKey) return emptyJournal(ownerKey);
    return store;
  } catch {
    return emptyJournal(ownerKey);
  }
}

export function writeJournalStore(store: JournalStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(JOURNAL_CHANGE_EVENT));
}

export function clearJournalForLogout(ownerKey: string): void {
  if (typeof window === "undefined") return;
  const existing = readJournalStore(ownerKey);
  if (existing.ownerKey === ownerKey) {
    window.localStorage.removeItem(JOURNAL_STORAGE_KEY);
    window.dispatchEvent(new Event(JOURNAL_CHANGE_EVENT));
  }
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

/**
 * Export notes. Private entries are included only when includePrivate is true.
 * Teacher-submitted reflections are separate and never mixed into a private-only export.
 */
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
