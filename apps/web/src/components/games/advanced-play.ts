import type {
  CaseFilesGame,
  DapitanGame,
  DispatchesGame,
  EditorialGame,
} from "@jose/shared";

export function caseClaimText(game: CaseFilesGame): string {
  return game.conclusions.find((item) => item.defensible)?.label ?? game.question;
}

export function strongestCaseSourceIds(game: CaseFilesGame): Set<string> {
  const conclusion = game.conclusions.find((item) => item.defensible);
  if (!conclusion) return new Set(game.sources.slice(0, 1).map((source) => source.id));
  const combos = game.acceptedEvidenceByConclusion[conclusion.id] ?? [];
  if (combos.length === 0) {
    return new Set(game.sources.slice(0, 1).map((source) => source.id));
  }
  let ids = new Set(combos[0]);
  for (const combo of combos.slice(1)) {
    ids = new Set([...ids].filter((id) => combo.includes(id)));
  }
  if (ids.size === 0) return new Set(combos[0]);
  return ids;
}

export function nextDispatchStop(game: DispatchesGame, currentId: string) {
  const unlocked = game.stops.find((stop) => stop.unlockAfterIds.includes(currentId));
  if (unlocked) return unlocked;
  const index = game.stops.findIndex((stop) => stop.id === currentId);
  return game.stops[index + 1] ?? null;
}

export function dispatchNextOptions(game: DispatchesGame, currentId: string) {
  const next = nextDispatchStop(game, currentId);
  const others = game.stops.filter((stop) => stop.id !== currentId);
  const options = next
    ? [next, ...others.filter((stop) => stop.id !== next.id)]
    : others;
  return options.slice(0, 3);
}

const FIRST_ROLES = ["claim", "evidence", "conclusion"] as const;

export function firstRoundEditorialSlots(game: EditorialGame) {
  return FIRST_ROLES.map((role) => game.slots.find((slot) => slot.role === role)).filter(
    (slot): slot is EditorialGame["slots"][number] => Boolean(slot),
  );
}

export function firstRoundEditorialOk(
  game: EditorialGame,
  placement: Record<string, string>,
): boolean {
  const slots = firstRoundEditorialSlots(game);
  if (slots.some((slot) => !placement[slot.id])) return false;
  return game.acceptedStructures.some((structure) =>
    slots.every((slot) => {
      const index = game.slots.findIndex((item) => item.id === slot.id);
      return structure[index] === placement[slot.id];
    }),
  );
}

export function editorialSlotPrompt(role: EditorialGame["slots"][number]["role"]): string {
  switch (role) {
    case "claim":
      return "What are you saying?";
    case "evidence":
      return "What evidence supports it?";
    case "conclusion":
      return "What should the reader understand?";
    default:
      return "Add a counterargument";
  }
}

export function firstDapitanProjects(game: DapitanGame) {
  return game.projects.slice(0, 3);
}
