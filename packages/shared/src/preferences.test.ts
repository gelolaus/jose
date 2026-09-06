import { describe, expect, it } from "vitest";
import {
  DEFAULT_READING_PREFERENCES,
  readingPreferencesSchema,
} from "./preferences";
import { lessonPackManifestSchema } from "./lesson-packs";

describe("reading preferences", () => {
  it("keeps narration off by default until licensed audio exists", () => {
    const prefs = readingPreferencesSchema.parse({ version: 1 });
    expect(prefs).toMatchObject({
      locale: "en",
      narrationEnabled: false,
      soundEnabled: false,
    });
    expect(DEFAULT_READING_PREFERENCES.narrationEnabled).toBe(false);
  });
});

describe("lesson packs", () => {
  it("requires practice-only and assessed-online-only flags", () => {
    const pack = lessonPackManifestSchema.parse({
      version: 1,
      packId: "ateneo-v1",
      moduleId: "ateneo",
      contentRevision: "rev-1",
      title: "Ateneo days",
      downloadedAt: 1,
      ownerKey: "local:Explorer",
      practiceOnly: true,
      assessedOnlineOnly: true,
    });
    expect(pack.practiceOnly).toBe(true);
    expect(pack.assessedOnlineOnly).toBe(true);
  });
});
