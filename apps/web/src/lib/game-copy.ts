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
  }
}
