import type { NodeStatus } from "./path";

export function deriveLevelStatuses(
  levelIdsInOrder: string[],
  completedIds: ReadonlySet<string>,
): Record<string, NodeStatus> {
  const result: Record<string, NodeStatus> = {};
  let foundCurrent = false;
  for (const id of levelIdsInOrder) {
    if (completedIds.has(id)) {
      result[id] = "completed";
    } else if (!foundCurrent) {
      result[id] = "current";
      foundCurrent = true;
    } else {
      result[id] = "locked";
    }
  }
  return result;
}

export function isLevelLocked(
  levelIdsInOrder: string[],
  completedIds: ReadonlySet<string>,
  levelId: string,
): boolean {
  const statuses = deriveLevelStatuses(levelIdsInOrder, completedIds);
  return statuses[levelId] === "locked";
}
