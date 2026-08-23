import type { GameContent } from "@jose/shared";

export function hintFor(type: GameContent["type"]) {
  switch (type) {
    case "timeline":
      return "Oldest at the top. Drag an event onto its stop — or tap the event, then tap the stop.";
    case "memory":
      return "Flip two cards. Find the pairs.";
    case "sort":
      return "Tap a chip, then a chest.";
    case "quiz":
      return "Read the stage. Tap the answer you trust.";
    case "blank":
      return "Fill the hole in the letter. One chip is the missing word.";
  }
}

export function labelFor(type: GameContent["type"]) {
  switch (type) {
    case "timeline":
      return "Timeline";
    case "memory":
      return "Match";
    case "sort":
      return "Chests";
    case "quiz":
      return "Quiz";
    case "blank":
      return "Letter";
  }
}
