import { extractMigratableBookmarkLevelIds } from "@jose/shared";
import { journalOwnerKey, journalStorageKey, parseJournalStore } from "@/lib/journal-store";
import { putBookmark } from "@/lib/path-api";

export function bookmarksMigratedKey(ownerKey: string) {
  return `jose.bookmarks.migrated.v1:${ownerKey}`;
}

export async function migrateLocalBookmarks(accountId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const ownerKey = journalOwnerKey(accountId);
  const flag = bookmarksMigratedKey(ownerKey);
  if (window.localStorage.getItem(flag) === "1") return;
  const raw = window.localStorage.getItem(journalStorageKey(ownerKey));
  let store: unknown = null;
  if (raw) {
    try {
      store = parseJournalStore(JSON.parse(raw) as unknown);
    } catch {
      store = null;
    }
  }
  const levelIds = extractMigratableBookmarkLevelIds(store, ownerKey);
  for (const levelId of levelIds) {
    try {
      await putBookmark(levelId);
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (status === 404) continue;
      throw err;
    }
  }
  window.localStorage.setItem(flag, "1");
}
