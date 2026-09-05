import { afterEach, describe, expect, it } from "vitest";
import {
  clearJournalForLogout,
  exportJournalNotes,
  journalOwnerKey,
  readJournalStore,
  searchJournal,
  upsertJournalEntry,
  writeJournalStore,
  emptyJournal,
} from "./journal-store";

describe("journal-store privacy", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults new reflections to private and keeps them out of teacher-only export", () => {
    const ownerKey = journalOwnerKey("Ana");
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

    const teacherOnly = exportJournalNotes(store, {
      includePrivate: false,
      includeTeacherSubmitted: true,
    });
    expect(teacherOnly.entries).toHaveLength(1);
    expect(teacherOnly.entries[0]?.visibility).toBe("teacher_submitted");
  });

  it("finds bookmarked passages and preserves source href for reopen", () => {
    const ownerKey = journalOwnerKey("Ana");
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

  it("does not leak another owner's notes on the same browser key", () => {
    writeJournalStore({
      version: 1,
      ownerKey: journalOwnerKey("Ana"),
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
    expect(readJournalStore(journalOwnerKey("Ben")).entries).toHaveLength(0);
    clearJournalForLogout(journalOwnerKey("Ana"));
    expect(readJournalStore(journalOwnerKey("Ana"))).toEqual(
      emptyJournal(journalOwnerKey("Ana")),
    );
  });
});
