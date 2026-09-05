import {
  lessonPackIndexSchema,
  lessonPackManifestSchema,
  type LessonPackIndex,
  type LessonPackManifest,
} from "@jose/shared";

export const LESSON_PACKS_KEY = "jose.lesson-packs.v1";
export const LESSON_PACKS_CHANGE_EVENT = "jose:lesson-packs-change";

export function emptyPackIndex(): LessonPackIndex {
  return { version: 1, packs: [] };
}

export function readLessonPackIndex(ownerKey: string): LessonPackIndex {
  if (typeof window === "undefined") return emptyPackIndex();
  try {
    const raw = window.localStorage.getItem(LESSON_PACKS_KEY);
    if (!raw) return emptyPackIndex();
    const parsed = lessonPackIndexSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return emptyPackIndex();
    return {
      version: 1,
      packs: parsed.data.packs.filter((p) => p.ownerKey === ownerKey),
    };
  } catch {
    return emptyPackIndex();
  }
}

function writeIndex(index: LessonPackIndex) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LESSON_PACKS_KEY, JSON.stringify(index));
  window.dispatchEvent(new Event(LESSON_PACKS_CHANGE_EVENT));
}

/**
 * Save or update a practice-only pack. Refuses to silently overwrite a newer revision.
 */
export function saveLessonPack(
  pack: LessonPackManifest,
): { ok: true; pack: LessonPackManifest } | { ok: false; reason: "newer_revision" | "invalid" } {
  const parsed = lessonPackManifestSchema.safeParse(pack);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const index = readLessonPackIndex(parsed.data.ownerKey);
  const existing = index.packs.find((p) => p.packId === parsed.data.packId);
  if (existing && compareRevisions(existing.contentRevision, parsed.data.contentRevision) > 0) {
    return { ok: false, reason: "newer_revision" };
  }
  const packs = existing
    ? index.packs.map((p) => (p.packId === parsed.data.packId ? parsed.data : p))
    : [...index.packs, parsed.data];
  writeIndex({ version: 1, packs });
  return { ok: true, pack: parsed.data };
}

export function removeLessonPack(ownerKey: string, packId: string): void {
  const index = readLessonPackIndex(ownerKey);
  writeIndex({
    version: 1,
    packs: index.packs.filter((p) => p.packId !== packId),
  });
}

/** Shared-device logout must clear account-scoped downloaded packs. */
export function clearLessonPacksForLogout(ownerKey: string): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(LESSON_PACKS_KEY);
  if (!raw) return;
  try {
    const parsed = lessonPackIndexSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      window.localStorage.removeItem(LESSON_PACKS_KEY);
      return;
    }
    writeIndex({
      version: 1,
      packs: parsed.data.packs.filter((p) => p.ownerKey !== ownerKey),
    });
  } catch {
    window.localStorage.removeItem(LESSON_PACKS_KEY);
  }
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
    contentRevision: input.contentRevision,
    title: input.title,
    downloadedAt: Date.now(),
    ownerKey: input.ownerKey,
    practiceOnly: true,
    assessedOnlineOnly: true,
  });
}
