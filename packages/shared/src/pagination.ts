import { z } from "zod";

/** Shared pagination contract for future teacher reports and list endpoints. */
export const paginationQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginateInMemory<T>(
  items: T[],
  query: PaginationQuery,
  getCursor: (item: T) => string,
): { items: T[]; nextCursor: string | null } {
  const start = query.cursor
    ? items.findIndex((item) => getCursor(item) === query.cursor) + 1
    : 0;
  const slice = items.slice(Math.max(0, start), Math.max(0, start) + query.limit);
  const last = slice[slice.length - 1];
  const nextCursor =
    last && start + query.limit < items.length ? getCursor(last) : null;
  return { items: slice, nextCursor };
}
