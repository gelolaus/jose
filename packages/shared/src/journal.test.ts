import { describe, expect, it } from "vitest";
import {
  journalEntrySchema,
  journalExportSchema,
  journalStoreSchema,
} from "./journal";

describe("journal schemas", () => {
  it("defaults reflections to private visibility", () => {
    const entry = journalEntrySchema.parse({
      id: "j1",
      kind: "reflection",
      title: "My note",
      body: "Private thought",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(entry.visibility).toBe("private");
  });

  it("rejects export payloads that mix flags incorrectly when empty entries", () => {
    const exported = journalExportSchema.parse({
      exportedAt: "2026-09-05T00:00:00.000Z",
      ownerKey: "local:Explorer",
      includePrivate: true,
      includeTeacherSubmitted: false,
      entries: [],
    });
    expect(exported.includeTeacherSubmitted).toBe(false);
  });

  it("parses a store with bookmarks linked to chapter context", () => {
    const store = journalStoreSchema.parse({
      version: 1,
      ownerKey: "local:Explorer",
      entries: [
        {
          id: "b1",
          kind: "bookmark",
          title: "Ateneo days",
          body: "Rizal entered Ateneo.",
          visibility: "private",
          source: {
            moduleId: "ateneo",
            levelId: "ateneo-1",
            href: "/learn/ateneo/ateneo-1",
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(store.entries[0]?.source?.href).toBe("/learn/ateneo/ateneo-1");
  });
});
