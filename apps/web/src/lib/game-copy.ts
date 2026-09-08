import type { GameContent } from "@jose/shared";

export function hintFor(type: GameContent["type"]) {
  switch (type) {
    case "timeline":
      return "Put the events in order. Tap a card, then a space.";
    case "memory":
      return "Find all the pairs before the timer runs out.";
    case "sort":
      return "Tap a card, choose its category, then Check.";
    case "quiz":
      return "Tap the answer you think is right.";
    case "blank":
      return "Tap the word that completes the sentence.";
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
      return "Timeline";
    case "memory":
      return "Matching";
    case "sort":
      return "Sorting";
    case "quiz":
      return "Quiz";
    case "blank":
      return "Fill in the Blank";
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
