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
  it("unlocks the three teaser trophies for the fixture", () => {
    expect(deriveTrophies(fixture)).toEqual([
      { id: "childhood-clear", title: "Childhood cleared", unlocked: true },
      { id: "first-treasure", title: "First treasure", unlocked: true },
      { id: "on-the-path", title: "On the path", unlocked: true },
    ]);
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
    expect(deriveTrophies(empty).map((t) => t.unlocked)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("highlightSectionId", () => {
  it("prefers the section with a current node", () => {
    expect(highlightSectionId(fixture)).toBe("education");
  });
});
