import { describe, expect, it } from "vitest";
import {
  approximateMinutesForKind,
  nextLevelAfter,
  pickContinueLearning,
} from "./continue";

describe("pickContinueLearning", () => {
  it("resumes the featured in-progress module", () => {
    const action = pickContinueLearning([
      {
        moduleId: "extra",
        moduleTitle: "Extra",
        featured: false,
        sectionTitle: "A",
        levelId: "e1",
        levelTitle: "Extra lesson",
        levelKind: "lesson",
        completedCount: 1,
        totalCount: 2,
      },
      {
        moduleId: "rizal",
        moduleTitle: "Rizal",
        featured: true,
        sectionTitle: "Education",
        levelId: "edu-1",
        levelTitle: "Ateneo",
        levelKind: "lesson",
        completedCount: 4,
        totalCount: 10,
      },
    ]);
    expect(action?.kind).toBe("resume");
    expect(action?.moduleId).toBe("rizal");
    expect(action?.href).toBe("/learn/rizal/edu-1");
    expect(action?.approximateMinutes).toBe(5);
  });

  it("suggests review when every module is complete", () => {
    const action = pickContinueLearning([
      {
        moduleId: "rizal",
        moduleTitle: "Rizal",
        featured: true,
        sectionTitle: "Martyrdom",
        levelId: "last",
        levelTitle: "Last",
        levelKind: "chest",
        completedCount: 5,
        totalCount: 5,
      },
    ]);
    expect(action?.kind).toBe("review");
    expect(action?.href).toBe("/learn/rizal");
  });
});

describe("nextLevelAfter", () => {
  it("returns the following id or null at the end", () => {
    expect(nextLevelAfter(["a", "b", "c"], "b")).toBe("c");
    expect(nextLevelAfter(["a", "b", "c"], "c")).toBeNull();
  });
});

describe("approximateMinutesForKind", () => {
  it("maps kinds to short durations", () => {
    expect(approximateMinutesForKind("lesson")).toBe(5);
    expect(approximateMinutesForKind("game")).toBe(4);
    expect(approximateMinutesForKind("chest")).toBe(1);
  });
});
