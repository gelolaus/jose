import { describe, expect, it } from "vitest";
import { extractMigratableBookmarkLevelIds } from "./bookmarks";

describe("extractMigratableBookmarkLevelIds", () => {
  const ownerKey = "account:usr-ana";

  it("keeps unique lesson bookmarks for the signed-in account key", () => {
    const ids = extractMigratableBookmarkLevelIds(
      {
        version: 1,
        ownerKey,
        entries: [
          {
            id: "b1",
            kind: "bookmark",
            title: "Ateneo",
            body: "",
            visibility: "private",
            source: {
              moduleId: "ateneo",
              levelId: "ateneo-welcome",
              href: "/learn/ateneo/ateneo-welcome",
            },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "b2",
            kind: "bookmark",
            title: "Ateneo again",
            body: "",
            visibility: "private",
            source: {
              moduleId: "ateneo",
              levelId: "ateneo-welcome",
              href: "/learn/ateneo/ateneo-welcome",
            },
            createdAt: 2,
            updatedAt: 2,
          },
          {
            id: "e1",
            kind: "excerpt",
            title: "Excerpt",
            body: "typed text",
            visibility: "private",
            source: {
              moduleId: "ateneo",
              levelId: "ateneo-class",
              href: "/learn/ateneo/ateneo-class",
            },
            createdAt: 3,
            updatedAt: 3,
          },
        ],
      },
      ownerKey,
    );
    expect(ids).toEqual(["ateneo-welcome"]);
  });

  it("ignores display-name keys, other accounts, and reflections", () => {
    expect(
      extractMigratableBookmarkLevelIds(
        {
          version: 1,
          ownerKey: "local:Explorer",
          entries: [
            {
              id: "b1",
              kind: "bookmark",
              title: "No",
              body: "",
              visibility: "private",
              source: {
                moduleId: "ateneo",
                levelId: "ateneo-welcome",
                href: "/learn/ateneo/ateneo-welcome",
              },
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        ownerKey,
      ),
    ).toEqual([]);

    expect(
      extractMigratableBookmarkLevelIds(
        {
          version: 1,
          ownerKey: "account:someone-else",
          entries: [
            {
              id: "b1",
              kind: "bookmark",
              title: "No",
              body: "",
              visibility: "private",
              source: {
                moduleId: "ateneo",
                levelId: "ateneo-welcome",
                href: "/learn/ateneo/ateneo-welcome",
              },
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        ownerKey,
      ),
    ).toEqual([]);
  });
});
