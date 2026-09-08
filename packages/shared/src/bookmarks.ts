import { z } from "zod";
import { journalStoreSchema } from "./journal";

export const bookmarkItemSchema = z.object({
  levelId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  available: z.boolean(),
  title: z.string().nullable(),
  moduleId: z.string().nullable(),
  moduleTitle: z.string().nullable(),
  completed: z.boolean(),
  href: z.string().nullable(),
});
export type BookmarkItem = z.infer<typeof bookmarkItemSchema>;

export const bookmarksResponseSchema = z.object({
  bookmarks: z.array(bookmarkItemSchema),
});
export type BookmarksResponse = z.infer<typeof bookmarksResponseSchema>;

export const bookmarkMutationResponseSchema = z.object({
  ok: z.boolean(),
  levelId: z.string().min(1),
  bookmarked: z.boolean(),
});
export type BookmarkMutationResponse = z.infer<typeof bookmarkMutationResponseSchema>;

/**
 * Reads only lesson bookmarks from the current account-scoped local journal.
 * Reflections, excerpts, display-name keys, and other accounts are ignored.
 */
export function extractMigratableBookmarkLevelIds(
  store: unknown,
  expectedOwnerKey: string,
): string[] {
  const parsed = journalStoreSchema.safeParse(store);
  if (!parsed.success) return [];
  if (parsed.data.ownerKey !== expectedOwnerKey) return [];
  if (!expectedOwnerKey.startsWith("account:")) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of parsed.data.entries) {
    if (entry.kind !== "bookmark") continue;
    const levelId = entry.source?.levelId?.trim();
    if (!levelId || seen.has(levelId)) continue;
    seen.add(levelId);
    ids.push(levelId);
  }
  return ids;
}
