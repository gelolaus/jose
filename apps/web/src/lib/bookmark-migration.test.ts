import { afterEach, describe, expect, it, vi } from "vitest";
import { extractMigratableBookmarkLevelIds } from "@jose/shared";
import { journalOwnerKey, journalStorageKey } from "./journal-store";
import { migrateLocalBookmarks } from "./bookmark-migration";
import { ApiError } from "./path-api";

vi.mock("./path-api", async () => {
  const actual = await vi.importActual<typeof import("./path-api")>("./path-api");
  return {
    ...actual,
    putBookmark: vi.fn(),
  };
});

import { putBookmark } from "./path-api";

describe("migrateLocalBookmarks", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.mocked(putBookmark).mockReset();
  });

  it("uploads account-scoped lesson bookmarks once and leaves reflections in place", async () => {
    const ownerKey = journalOwnerKey("usr-ana");
    window.localStorage.setItem(
      journalStorageKey(ownerKey),
      JSON.stringify({
        version: 1,
        ownerKey,
        entries: [
          {
            id: "b1",
            kind: "bookmark",
            title: "Ateneo",
            body: "",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
            source: { moduleId: "ateneo", levelId: "welcome", href: "/learn/ateneo/welcome" },
          },
          {
            id: "r1",
            kind: "reflection",
            title: "Private note",
            body: "should stay local",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );
    vi.mocked(putBookmark).mockResolvedValue({
      ok: true,
      levelId: "welcome",
      bookmarked: true,
    });

    await migrateLocalBookmarks("usr-ana");
    expect(putBookmark).toHaveBeenCalledWith("welcome");
    expect(window.localStorage.getItem(`jose.bookmarks.migrated.v1:${ownerKey}`)).toBe("1");
    expect(window.localStorage.getItem(journalStorageKey(ownerKey))).toContain("Private note");

    await migrateLocalBookmarks("usr-ana");
    expect(putBookmark).toHaveBeenCalledTimes(1);
  });

  it("does not mark migration complete when a network save fails", async () => {
    const ownerKey = journalOwnerKey("usr-ana");
    window.localStorage.setItem(
      journalStorageKey(ownerKey),
      JSON.stringify({
        version: 1,
        ownerKey,
        entries: [
          {
            id: "b1",
            kind: "bookmark",
            title: "Ateneo",
            body: "",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
            source: { moduleId: "ateneo", levelId: "welcome", href: "/learn/ateneo/welcome" },
          },
        ],
      }),
    );
    vi.mocked(putBookmark).mockRejectedValue(new ApiError("offline", 500));
    await expect(migrateLocalBookmarks("usr-ana")).rejects.toBeInstanceOf(ApiError);
    expect(window.localStorage.getItem(`jose.bookmarks.migrated.v1:${ownerKey}`)).toBeNull();
  });

  it("ignores display-name keyed blobs", () => {
    const ids = extractMigratableBookmarkLevelIds(
      {
        version: 1,
        ownerKey: "local:Ana",
        entries: [],
      },
      journalOwnerKey("usr-ana"),
    );
    expect(ids).toEqual([]);
  });
});
