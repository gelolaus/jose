export type SessionProgress = {
  label: string;
  value: number;
  max: number;
};

type ProgressGame = {
  type: string;
  questions?: readonly unknown[];
  items?: readonly unknown[];
  pairs?: readonly unknown[];
  pairCount?: number;
};

/** Question 1 (or the matching empty bar) before a game reports a move. */
export function openingProgress(game: ProgressGame): SessionProgress | null {
  switch (game.type) {
    case "quiz": {
      const max = game.questions?.length ?? 0;
      if (max < 1) return null;
      return { label: `Question 1 of ${max}`, value: 0, max };
    }
    case "blank": {
      const max = game.items?.length ?? 0;
      if (max < 1) return null;
      return { label: `Sentence 1 of ${max}`, value: 0, max };
    }
    case "sort": {
      const max = game.items?.length ?? 0;
      if (max < 1) return null;
      return { label: `0 of ${max} cards placed`, value: 0, max };
    }
    case "timeline": {
      const max = game.items?.length ?? 0;
      if (max < 1) return null;
      return { label: `0 of ${max} events placed`, value: 0, max };
    }
    case "memory": {
      const max = game.pairCount ?? game.pairs?.length ?? 0;
      if (max < 1) return null;
      return { label: `0 of ${max} pairs matched`, value: 0, max };
    }
    default:
      return null;
  }
}
