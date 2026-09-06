import { describe, expect, it } from "vitest";
import {
  accessibleColorName,
  contrastRatio,
  meetsWcagAa,
  bestLabelInk,
} from "./contrast";
import {
  classifyFailure,
  developmentDiagnostics,
  studentSafeErrorMessage,
} from "./recovery";
import { compareRevisions, saveLessonPack, clearLessonPacksForLogout, readLessonPackIndex } from "./lesson-packs";
import { t } from "./reading-preferences";

describe("contrast", () => {
  it("names author swatches and checks white label contrast", () => {
    expect(accessibleColorName("#A855F7")).toBe("Violet");
    expect(contrastRatio("#FFFFFF", "#0F172A")).toBeGreaterThan(4.5);
    expect(meetsWcagAa("#FFFFFF", "#F5C518", true)).toBeTypeOf("boolean");
    expect(["#FFFFFF", "#0F172A"]).toContain(bestLabelInk("#22C55E"));
  });
});

describe("recovery copy", () => {
  it("never surfaces terminal commands to students", () => {
    const message = studentSafeErrorMessage(
      "Can't reach the Jose API. Run npm run dev:api on port 3001",
      "unavailable",
    );
    expect(message).not.toMatch(/npm /i);
    expect(message).not.toMatch(/3001/);
  });

  it("distinguishes offline from generic outages", () => {
    expect(classifyFailure({ offline: true })).toBe("offline");
    expect(classifyFailure({ status: 404 })).toBe("not_found");
  });

  it("keeps diagnostics available in non-production checks", () => {
    // production path returns null; verify the helper still sanitizes student copy separately
    expect(studentSafeErrorMessage("npm run dev:api", "unavailable")).not.toMatch(/npm/);
    if (process.env.NODE_ENV !== "production") {
      expect(developmentDiagnostics("npm run dev:api")).toContain("npm");
    }
  });
});

describe("lesson packs", () => {
  it("refuses silent overwrite of a newer revision and clears on logout", () => {
    window.localStorage.clear();
    const ownerKey = "account:usr-ana";
    const first = saveLessonPack({
      version: 1,
      packId: "ateneo:rev-2",
      moduleId: "ateneo",
      contentRevision: "rev-2",
      title: "Ateneo",
      downloadedAt: 1,
      ownerKey,
      practiceOnly: true,
      assessedOnlineOnly: true,
    });
    expect(first.ok).toBe(true);

    const older = saveLessonPack({
      version: 1,
      packId: "ateneo:rev-2",
      moduleId: "ateneo",
      contentRevision: "rev-1",
      title: "Ateneo",
      downloadedAt: 2,
      ownerKey,
      practiceOnly: true,
      assessedOnlineOnly: true,
    });
    expect(older).toEqual({ ok: false, reason: "newer_revision" });
    expect(compareRevisions("rev-2", "rev-1")).toBe(1);

    clearLessonPacksForLogout(ownerKey);
    expect(readLessonPackIndex(ownerKey).packs).toHaveLength(0);
  });

  it("isolates pack metadata for two accounts on one computer", () => {
    window.localStorage.clear();
    const ana = "account:1";
    const ben = "account:2";
    expect(
      saveLessonPack({
        version: 1,
        packId: "a",
        moduleId: "m",
        contentRevision: "rev-1",
        title: "Ana pack",
        downloadedAt: 1,
        ownerKey: ana,
        practiceOnly: true,
        assessedOnlineOnly: true,
      }).ok,
    ).toBe(true);
    expect(
      saveLessonPack({
        version: 1,
        packId: "b",
        moduleId: "m",
        contentRevision: "rev-1",
        title: "Ben pack",
        downloadedAt: 1,
        ownerKey: ben,
        practiceOnly: true,
        assessedOnlineOnly: true,
      }).ok,
    ).toBe(true);
    expect(readLessonPackIndex(ana).packs.map((p) => p.title)).toEqual(["Ana pack"]);
    expect(readLessonPackIndex(ben).packs.map((p) => p.title)).toEqual(["Ben pack"]);
    expect(
      saveLessonPack({
        version: 1,
        packId: "x",
        moduleId: "m",
        contentRevision: "rev-1",
        title: "Name keyed",
        downloadedAt: 1,
        ownerKey: "local:Ana",
        practiceOnly: true,
        assessedOnlineOnly: true,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("ui dictionaries", () => {
  it("provides Filipino chrome without inventing lesson translations", () => {
    expect(t("fil", "nav.journal")).toBe("Talaarawan");
    expect(t("en", "prefs.contentTranslationPending")).toMatch(/not loaded yet/i);
  });
});
