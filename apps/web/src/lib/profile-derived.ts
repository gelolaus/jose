import type { PathResponse, Section } from "@jose/shared";
import { deriveAchievements } from "@jose/shared";

export type TrophyId =
  | "on-the-path"
  | "first-treasure"
  | "first-chapter-clear"
  | "course-complete";

export type Trophy = {
  id: TrophyId;
  title: string;
  unlocked: boolean;
};

export function sectionProgress(section: Section): {
  completed: number;
  total: number;
} {
  const total = section.nodes.length;
  const completed = section.nodes.filter((n) => n.status === "completed").length;
  return { completed, total };
}

/** Local helper kept for fixtures; production profile uses /profile/stats. */
export function deriveTrophies(path: PathResponse): Trophy[] {
  const allNodes = path.sections.flatMap((section) => section.nodes);
  const hasAnyProgress = allNodes.some(
    (n) => n.status === "completed" || n.status === "current",
  );
  const chestsOpened = allNodes.filter(
    (n) => n.kind === "chest" && n.status === "completed",
  ).length;
  const anyChapterFullyComplete = path.sections.some(
    (section) =>
      section.nodes.length > 0 &&
      section.nodes.every((n) => n.status === "completed"),
  );
  const allPublishedComplete =
    path.sections.length > 0 &&
    path.sections.every((section) =>
      section.nodes.every((n) => n.status === "completed"),
    );

  return deriveAchievements({
    hasAnyProgress,
    chestsOpened,
    anyChapterFullyComplete,
    allPublishedComplete,
    // Monotonic: once you have been "on the path", finishing never revokes it.
    previouslyEarned: hasAnyProgress ? new Set(["on-the-path"]) : new Set(),
  }).map((achievement) => ({
    id: achievement.id,
    title: achievement.title,
    unlocked: achievement.unlocked,
  }));
}

export function highlightSectionId(path: PathResponse): string | null {
  for (const section of path.sections) {
    if (section.nodes.some((n) => n.status === "current")) {
      return section.id;
    }
  }
  for (const section of path.sections) {
    if (section.nodes.some((n) => n.status !== "completed")) {
      return section.id;
    }
  }
  return path.sections[0]?.id ?? null;
}
