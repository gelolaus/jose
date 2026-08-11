import type { PathResponse, Section } from "@jose/shared";

export type TrophyId = "childhood-clear" | "first-treasure" | "on-the-path";

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

export function deriveTrophies(path: PathResponse): Trophy[] {
  const allNodes = path.sections.flatMap((section) => section.nodes);
  const childhood = path.sections.find((section) => section.id === "childhood");

  return [
    {
      id: "childhood-clear",
      title: "Childhood cleared",
      unlocked: Boolean(
        childhood && childhood.nodes.every((n) => n.status === "completed"),
      ),
    },
    {
      id: "first-treasure",
      title: "First treasure",
      unlocked: allNodes.some(
        (n) => n.kind === "chest" && n.status === "completed",
      ),
    },
    {
      id: "on-the-path",
      title: "On the path",
      unlocked: allNodes.some((n) => n.status === "current"),
    },
  ];
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
