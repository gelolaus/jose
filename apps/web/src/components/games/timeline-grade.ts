import type { TimelineGame, TimelineItem } from "@jose/shared";
import type { WhyPayload } from "./play-types";

type Placed = Record<number, string>;

function orderKey(item: TimelineItem): string {
  return item.groupId?.trim() || `__solo_${item.id}`;
}

export function allStopsFilled(items: TimelineItem[], placed: Placed): boolean {
  return items.length > 0 && items.every((_, index) => Boolean(placed[index]));
}

/**
 * Solo events must land on their authored stop. Items that share a groupId may
 * occupy any stop in that group (simultaneous / uncertain chronology).
 */
export function gradeTimelineCheck(
  items: TimelineItem[],
  placed: Placed,
): { correctIds: string[]; wrongItems: TimelineItem[]; perfect: boolean } {
  const correctIds: string[] = [];
  const wrongItems: TimelineItem[] = [];

  items.forEach((slotItem, index) => {
    const placedId = placed[index];
    if (!placedId) return;
    const occupant = items.find((entry) => entry.id === placedId);
    if (!occupant) return;
    if (orderKey(slotItem) === orderKey(occupant)) {
      correctIds.push(occupant.id);
      return;
    }
    wrongItems.push(occupant);
  });

  const uniqueCorrect = [...new Set(correctIds)];
  const uniqueWrong = [...new Map(wrongItems.map((item) => [item.id, item])).values()];
  const perfect =
    uniqueWrong.length === 0 &&
    uniqueCorrect.length === items.length &&
    new Set(Object.values(placed)).size === items.length;

  return { correctIds: uniqueCorrect, wrongItems: uniqueWrong, perfect };
}

export function formatTimelineWhy(wrongItems: TimelineItem[]): WhyPayload | null {
  const withWhy = wrongItems.filter((item) => item.why?.trim());
  if (withWhy.length === 0) return null;
  if (withWhy.length === 1) {
    const item = withWhy[0]!;
    return { title: item.label, body: item.why!.trim(), tone: "miss" };
  }
  return {
    title: "Check these again",
    body: withWhy.map((item) => `${item.label} — ${item.why!.trim()}`).join("\n\n"),
    tone: "miss",
  };
}

export function gradeCausalChoice(
  game: Pick<TimelineGame, "causalLink">,
  choiceId: string | null,
): { perfect: boolean; explanation: string | null } {
  const link = game.causalLink;
  if (!link) return { perfect: true, explanation: null };
  if (!choiceId) return { perfect: false, explanation: link.explanation };
  return {
    perfect: choiceId === link.correctChoiceId,
    explanation: link.explanation,
  };
}
