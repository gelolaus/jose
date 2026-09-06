import type { PathResponse } from "@jose/shared";
import { describe, expect, it } from "vitest";
import {
  deriveTrophies,
  highlightSectionId,
  sectionProgress,
} from "./profile-derived";

const fixture: PathResponse = {
  module: {
    id: "rizal",
    title: "Work and Life of Rizal",
    subtitle: "From Calamba to Bagumbayan",
    coverColor: "#A855F7",
    featured: true,
  },
  learner: {
    id: "demo-student",
    displayName: "Explorer",
    streak: 3,
    hearts: 5,
    xp: 120,
  },
  sections: [
    {
      id: "childhood",
      title: "Childhood",
      subtitle: "Calamba beginnings",
      themeColor: "#A855F7",
      objectives: [],
      instructorReviewStatus: "unreviewed",
      nodes: [
        {
          id: "c1",
          title: "Born",
          kind: "lesson",
          status: "completed",
          icon: "check",
          position: "center",
        },
        {
          id: "c-chest",
          title: "Treasure",
          kind: "chest",
          status: "completed",
          icon: "chest",
          position: "center",
        },
      ],
    },
    {
      id: "education",
      title: "Education",
      subtitle: "School days",
      themeColor: "#22C55E",
      objectives: [],
      instructorReviewStatus: "unreviewed",
      nodes: [
        {
          id: "e1",
          title: "Ateneo",
          kind: "lesson",
          status: "current",
          icon: "book",
          position: "left",
        },
        {
          id: "e2",
          title: "UST",
          kind: "lesson",
          status: "locked",
          icon: "book",
          position: "right",
        },
      ],
    },
  ],
};

describe("sectionProgress", () => {
  it("counts completed nodes", () => {
    expect(sectionProgress(fixture.sections[0]!)).toEqual({
      completed: 2,
      total: 2,
    });
    expect(sectionProgress(fixture.sections[1]!)).toEqual({
      completed: 0,
      total: 2,
    });
  });
});

describe("deriveTrophies", () => {
  it("unlocks path trophies for the fixture", () => {
    const trophies = deriveTrophies(fixture);
    expect(trophies.find((t) => t.id === "on-the-path")?.unlocked).toBe(true);
    expect(trophies.find((t) => t.id === "first-treasure")?.unlocked).toBe(true);
    expect(trophies.find((t) => t.id === "first-chapter-clear")?.unlocked).toBe(
      true,
    );
  });

  it("keeps on-the-path after the course is fully complete", () => {
    const complete: PathResponse = {
      ...fixture,
      sections: fixture.sections.map((section) => ({
        ...section,
        nodes: section.nodes.map((node) => ({
          ...node,
          status: "completed" as const,
          icon: "check" as const,
        })),
      })),
    };
    expect(deriveTrophies(complete).find((t) => t.id === "on-the-path")?.unlocked).toBe(
      true,
    );
    expect(
      deriveTrophies(complete).find((t) => t.id === "course-complete")?.unlocked,
    ).toBe(true);
  });

  it("keeps trophies locked when progress is empty", () => {
    const empty: PathResponse = {
      ...fixture,
      sections: [
        {
          ...fixture.sections[0]!,
          nodes: [
            {
              id: "c1",
              title: "Born",
              kind: "lesson",
              status: "locked",
              icon: "book",
              position: "center",
            },
          ],
        },
      ],
    };
    expect(deriveTrophies(empty).every((t) => !t.unlocked)).toBe(true);
  });
});

describe("highlightSectionId", () => {
  it("prefers the section with a current node", () => {
    expect(highlightSectionId(fixture)).toBe("education");
  });
});
