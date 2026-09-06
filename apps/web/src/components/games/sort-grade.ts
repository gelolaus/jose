import type { SortGame, SortItem } from "@jose/shared";
import type { WhyPayload } from "./play-types";

type Placed = Record<string, string>;

export function scoredSortItems(items: SortItem[]): SortItem[] {
  return items.filter((item) => item.scoring !== "discussion");
}

export function discussionSortItems(items: SortItem[]): SortItem[] {
  return items.filter((item) => item.scoring === "discussion");
}

export function allChipsPlaced(items: SortItem[], placed: Placed): boolean {
  return items.every((item) => Boolean(placed[item.id]));
}

export function gradeSortCheck(
  items: SortItem[],
  placed: Placed,
): { correctIds: string[]; wrongItems: SortItem[]; perfect: boolean; discussionIds: string[] } {
  const correctIds: string[] = [];
  const wrongItems: SortItem[] = [];
  const discussionIds: string[] = [];

  for (const item of items) {
    if (item.scoring === "discussion") {
      if (placed[item.id]) discussionIds.push(item.id);
      continue;
    }
    if (placed[item.id] === item.bucketId) correctIds.push(item.id);
    else wrongItems.push(item);
  }

  const autoItems = scoredSortItems(items);
  return {
    correctIds,
    wrongItems,
    discussionIds,
    perfect: wrongItems.length === 0 && correctIds.length === autoItems.length,
  };
}

export function formatSortWhy(wrongItems: SortItem[]): WhyPayload | null {
  const withWhy = wrongItems.filter((item) => item.why?.trim());
  if (withWhy.length === 0) return null;
  if (withWhy.length === 1) {
    const item = withWhy[0]!;
    return {
      title: item.label,
      body: item.why!.trim(),
      tone: "miss",
      sourceLabel: item.source?.citation || item.source?.label,
    };
  }
  return {
    title: "Check these again",
    body: withWhy.map((item) => `${item.label} — ${item.why!.trim()}`).join("\n\n"),
    tone: "miss",
  };
}

export function formatSortExplanations(
  game: SortGame,
  itemIds: string[],
): WhyPayload | null {
  const lines = itemIds
    .map((id) => game.items.find((item) => item.id === id))
    .filter((item): item is SortItem => Boolean(item?.why?.trim()))
    .map((item) => `${item.label} — ${item.why!.trim()}`);
  if (lines.length === 0) return null;
  return {
    title: "Curator notes",
    body: lines.join("\n\n"),
    tone: "explain",
  };
}
