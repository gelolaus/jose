import type { GameContent } from "@jose/shared";

export function hintFor(type: GameContent["type"]) {
  switch (type) {
    case "timeline":
      return "Order the events, then explain the connection.";
    case "memory":
      return "Match archive cards. Learning mode has no timer.";
    case "sort":
      return "Sort evidence into the curator chests, then Check.";
    case "quiz":
      return "Answer the claim with the strongest evidence when asked.";
    case "blank":
      return "Restore the missing word in the sourced passage.";
    case "case-files":
      return "Read the claim. Tap the evidence that supports it best.";
    case "dispatches":
      return "Follow Rizal’s route. Tap the place that comes next.";
    case "editorial":
      return "Put these three pieces in order: Claim, Evidence, Conclusion.";
    case "dapitan":
      return "Choose the action that best helps the community.";
  }
}

export function labelFor(type: GameContent["type"]) {
  switch (type) {
    case "timeline":
      return "Cause & consequence";
    case "memory":
      return "Archive match";
    case "sort":
      return "Curator's desk";
    case "quiz":
      return "Evidence duel";
    case "blank":
      return "Restore the passage";
    case "case-files":
      return "Find the proof";
    case "dispatches":
      return "Choose the next stop";
    case "editorial":
      return "Build the story";
    case "dapitan":
      return "Choose the best plan";
  }
}

export function howToPlay(type: GameContent["type"]) {
  return hintFor(type);
}
