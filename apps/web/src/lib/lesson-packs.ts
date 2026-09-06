import {
  lessonPackIndexSchema,
  lessonPackManifestSchema,
  type LessonPackIndex,
  type LessonPackManifest,
} from "@jose/shared";

export const LESSON_PACKS_KEY = "jose.lesson-packs.v1";
export const LESSON_PACKS_CHANGE_EVENT = "jose:lesson-packs-change";

export function lessonPackStorageKey(ownerKey: string): string {
  return `${LESSON_PACKS_KEY}:${ownerKey}`;
}

export function emptyPackIndex(): LessonPackIndex {
  return { version: 1, packs: [] };
}

export function readLessonPackIndex(ownerKey: string): LessonPackIndex {
  if (typeof window === "undefined" || !ownerKey) return emptyPackIndex();
  try {
    const scoped = window.localStorage.getItem(lessonPackStorageKey(ownerKey));
    if (scoped) {
      const parsed = lessonPackIndexSchema.safeParse(JSON.parse(scoped) as unknown);
      if (!parsed.success) return emptyPackIndex();
      return {
        version: 1,
        packs: parsed.data.packs.filter((p) => p.ownerKey === ownerKey),
      };
    }
    // Do not adopt the unscoped prototype blob — it is not account-isolated.
    return emptyPackIndex();
  } catch {
    return emptyPackIndex();
  }
}

function writeIndex(ownerKey: string, index: LessonPackIndex) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    lessonPackStorageKey(ownerKey),
    JSON.stringify({
      version: 1,
      packs: index.packs.filter((p) => p.ownerKey === ownerKey),
    }),
  );
  window.dispatchEvent(new Event(LESSON_PACKS_CHANGE_EVENT));
}

/**
 * Save or update a practice-only pack. Refuses to silently overwrite a newer revision.
 */
export function saveLessonPack(
  pack: LessonPackManifest,
): { ok: true; pack: LessonPackManifest } | { ok: false; reason: "newer_revision" | "invalid" } {
  const parsed = lessonPackManifestSchema.safeParse(pack);
  if (!parsed.success || !parsed.data.ownerKey.startsWith("account:")) {
    return { ok: false, reason: "invalid" };
  }
  const ownerKey = parsed.data.ownerKey;
  const index = readLessonPackIndex(ownerKey);
  const existing = index.packs.find((p) => p.packId === parsed.data.packId);
  if (existing && compareRevisions(existing.contentRevision, parsed.data.contentRevision) > 0) {
    return { ok: false, reason: "newer_revision" };
  }
  const packs = existing
    ? index.packs.map((p) => (p.packId === parsed.data.packId ? parsed.data : p))
    : [...index.packs, parsed.data];
  writeIndex(ownerKey, { version: 1, packs });
  return { ok: true, pack: parsed.data };
}

export function removeLessonPack(ownerKey: string, packId: string): void {
  if (!ownerKey) return;
  const index = readLessonPackIndex(ownerKey);
  writeIndex(ownerKey, {
    version: 1,
    packs: index.packs.filter((p) => p.packId !== packId),
  });
}

/** Shared-device logout must clear this account's downloaded pack metadata. */
export function clearLessonPacksForLogout(ownerKey: string): void {
  if (typeof window === "undefined") return;
  if (ownerKey) {
    window.localStorage.removeItem(lessonPackStorageKey(ownerKey));
  }
  window.localStorage.removeItem(LESSON_PACKS_KEY);
  window.dispatchEvent(new Event(LESSON_PACKS_CHANGE_EVENT));
}

/** Lexicographic revision compare; owners should supply sortable revision stamps. */
export function compareRevisions(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

/**
 * Placeholder download: real pack payloads need owner-supplied CDN/storage.
 * This records a clearly labeled practice-only manifest only.
 */
export function registerPracticePackStub(input: {
  ownerKey: string;
  moduleId: string;
  title: string;
  contentRevision: string;
}): ReturnType<typeof saveLessonPack> {
  return saveLessonPack({
    version: 1,
    packId: `${input.moduleId}:${input.contentRevision}`,
    moduleId: input.moduleId,
    title: input.title,
    contentRevision: input.contentRevision,
    downloadedAt: Date.now(),
    ownerKey: input.ownerKey,
    practiceOnly: true,
    assessedOnlineOnly: true,
  });
}
