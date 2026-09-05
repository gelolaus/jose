import type { GameContent } from "@jose/shared";

export function hintFor(type: GameContent["type"]) {
  switch (type) {
    case "timeline":
      return "Put every event on its stop, then Check.";
    case "memory":
      return "Flip two cards. Match the picture to the name before the clock runs out.";
    case "sort":
      return "Put every chip in a chest, then Check.";
    case "quiz":
      return "Read the stage. Tap the answer you trust.";
    case "blank":
      return "Fill the hole in the letter. One chip is the missing word.";
    case "case-files":
      return "Inspect the documents, tag evidence, then defend a conclusion.";
    case "dispatches":
      return "Open each stop from the list (or map), then send a short dispatch.";
    case "editorial":
      return "Build a coherent editorial. More than one structure can work.";
    case "dapitan":
      return "Plan projects with limited resources. Undo anytime — no timers.";
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
    case "case-files":
      return "Case Files";
    case "dispatches":
      return "Dispatches";
    case "editorial":
      return "Editorial";
    case "dapitan":
      return "Dapitan";
  }
}
