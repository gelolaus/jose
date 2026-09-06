import { afterEach, describe, expect, it } from "vitest";
import {
  clearJournalForLogout,
  exportJournalNotes,
  journalOwnerKey,
  journalStorageKey,
  readJournalStore,
  searchJournal,
  switchJournalAccount,
  upsertJournalEntry,
  writeJournalStore,
  emptyJournal,
  JOURNAL_LEGACY_STORAGE_KEY,
} from "./journal-store";

describe("journal-store privacy", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("keys notes by account ID, not display name", () => {
    expect(journalOwnerKey("usr-ana")).toBe("account:usr-ana");
    expect(() => journalOwnerKey("  ")).toThrow(/account ID/i);
  });

  it("keeps notes when the display name would have changed", () => {
    const ownerKey = journalOwnerKey("usr-ana");
    upsertJournalEntry(ownerKey, {
      kind: "reflection",
      title: "Exam prep",
      body: "Remember the Ateneo excerpt",
    });
    expect(readJournalStore(ownerKey).entries).toHaveLength(1);
    expect(readJournalStore(journalOwnerKey("usr-ana")).entries[0]?.title).toBe(
      "Exam prep",
    );
  });

  it("isolates two accounts that share a display name on one computer", () => {
    const ana = journalOwnerKey("account-1");
    const ben = journalOwnerKey("account-2");
    upsertJournalEntry(ana, {
      kind: "reflection",
      title: "Ana private",
      body: "secret-a",
    });
    upsertJournalEntry(ben, {
      kind: "reflection",
      title: "Ben private",
      body: "secret-b",
    });
    expect(readJournalStore(ana).entries.map((e) => e.title)).toEqual(["Ana private"]);
    expect(readJournalStore(ben).entries.map((e) => e.title)).toEqual(["Ben private"]);
    expect(window.localStorage.getItem(journalStorageKey(ana))).toContain("secret-a");
    expect(window.localStorage.getItem(journalStorageKey(ben))).not.toContain("secret-a");
  });

  it("does not adopt a legacy display-name blob for a signed-in account", () => {
    window.localStorage.setItem(
      JOURNAL_LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        ownerKey: "local:Ana",
        entries: [
          {
            id: "old",
            kind: "reflection",
            title: "Old name-keyed note",
            body: "should not attach",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );
    expect(readJournalStore(journalOwnerKey("usr-ana")).entries).toHaveLength(0);
  });

  it("defaults new reflections to private and keeps them out of teacher-only export", () => {
    const ownerKey = journalOwnerKey("usr-ana");
    upsertJournalEntry(ownerKey, {
      kind: "reflection",
      title: "Exam prep",
      body: "Remember the Ateneo excerpt",
    });
    upsertJournalEntry(ownerKey, {
      kind: "reflection",
      title: "For class",
      body: "Submitted answer",
      visibility: "teacher_submitted",
    });

    const store = readJournalStore(ownerKey);
    const privateOnly = exportJournalNotes(store, {
      includePrivate: true,
      includeTeacherSubmitted: false,
    });
    expect(privateOnly.entries).toHaveLength(1);
    expect(privateOnly.entries[0]?.title).toBe("Exam prep");
    expect(privateOnly.entries[0]?.visibility).toBe("private");
  });

  it("finds bookmarked passages and preserves source href for reopen", () => {
    const ownerKey = journalOwnerKey("usr-ana");
    upsertJournalEntry(ownerKey, {
      kind: "bookmark",
      title: "Ateneo entry",
      body: "Rizal entered Ateneo Municipal",
      source: {
        moduleId: "ateneo",
        levelId: "lvl-1",
        levelTitle: "First days",
        href: "/learn/ateneo/lvl-1",
      },
    });
    const hits = searchJournal(readJournalStore(ownerKey), "Ateneo Municipal");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.source?.href).toBe("/learn/ateneo/lvl-1");
  });

  it("clears the signed-out account's journal without exposing another account's notes", () => {
    const ana = journalOwnerKey("account-1");
    const ben = journalOwnerKey("account-2");
    writeJournalStore({
      version: 1,
      ownerKey: ana,
      entries: [
        {
          id: "a1",
          kind: "reflection",
          title: "Ana private",
          body: "secret",
          visibility: "private",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    upsertJournalEntry(ben, {
      kind: "reflection",
      title: "Ben private",
      body: "other",
    });
    clearJournalForLogout(ana);
    expect(readJournalStore(ana)).toEqual(emptyJournal(ana));
    expect(readJournalStore(ben).entries[0]?.title).toBe("Ben private");
  });

  it("refuses to persist a display-name owner key", () => {
    expect(() =>
      writeJournalStore({
        version: 1,
        ownerKey: "local:Ana",
        entries: [],
      }),
    ).toThrow(/account ID/i);
  });

  it("switches accounts without copying the previous notes", () => {
    const ana = journalOwnerKey("account-1");
    const ben = journalOwnerKey("account-2");
    upsertJournalEntry(ana, {
      kind: "reflection",
      title: "Ana only",
      body: "keep",
    });
    const next = switchJournalAccount(ana, ben);
    expect(next.entries).toHaveLength(0);
    expect(readJournalStore(ana).entries[0]?.title).toBe("Ana only");
  });
});
