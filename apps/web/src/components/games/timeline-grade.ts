import type { TimelineGame } from "@jose/shared";
import type { WhyPayload } from "./play-types";

type TimelineItem = TimelineGame["items"][number];
type Placed = Record<number, string>;

export function allStopsFilled(items: TimelineItem[], placed: Placed): boolean {
  return items.length > 0 && items.every((_, index) => Boolean(placed[index]));
}

export function gradeTimelineCheck(
  items: TimelineItem[],
  placed: Placed,
): { correctIds: string[]; wrongItems: TimelineItem[]; perfect: boolean } {
  const correctIds: string[] = [];
  const wrongItems: TimelineItem[] = [];
  items.forEach((item, index) => {
    if (placed[index] === item.id) {
      correctIds.push(item.id);
      return;
    }
    const occupant = items.find((entry) => entry.id === placed[index]);
    if (occupant) wrongItems.push(occupant);
  });
  return { correctIds, wrongItems, perfect: wrongItems.length === 0 };
}

export function formatTimelineWhy(wrongItems: TimelineItem[]): WhyPayload | null {
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
