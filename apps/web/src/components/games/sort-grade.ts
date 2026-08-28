import type { SortGame } from "@jose/shared";
import type { WhyPayload } from "./play-types";

type SortItem = SortGame["items"][number];
type Placed = Record<string, string>;

export function allChipsPlaced(items: SortItem[], placed: Placed): boolean {
  return items.every((item) => Boolean(placed[item.id]));
}

export function gradeSortCheck(
  items: SortItem[],
  placed: Placed,
): { correctIds: string[]; wrongItems: SortItem[]; perfect: boolean } {
  const correctIds: string[] = [];
  const wrongItems: SortItem[] = [];
  for (const item of items) {
    if (placed[item.id] === item.bucketId) correctIds.push(item.id);
    else wrongItems.push(item);
  }
  return { correctIds, wrongItems, perfect: wrongItems.length === 0 };
}

export function formatSortWhy(wrongItems: SortItem[]): WhyPayload | null {
  const withWhy = wrongItems.filter((item) => item.why?.trim());
  if (withWhy.length === 0) return null;
  if (withWhy.length === 1) {
    const item = withWhy[0]!;
    return { title: item.label, body: item.why!.trim() };
  }
  return {
    title: "Check these again",
    body: withWhy.map((item) => `${item.label} — ${item.why!.trim()}`).join("\n\n"),
  };
}
