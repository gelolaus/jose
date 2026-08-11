import { describe, expect, it } from "vitest";
import { pathResponseSchema } from "./path";

const sample = {
  course: { id: "rizal", title: "Work and Life of Rizal" },
  learner: { displayName: "Explorer", streak: 3, hearts: 5, xp: 120 },
  sections: [
    {
      id: "childhood",
      title: "Childhood",
      subtitle: "Calamba beginnings",
      themeColor: "#7C3AED",
      nodes: [
        {
          id: "c1",
          title: "Born in Calamba",
          kind: "lesson",
          status: "completed",
          icon: "check",
          position: "center",
        },
      ],
    },
  ],
};

describe("pathResponseSchema", () => {
  it("accepts a valid path payload", () => {
    expect(pathResponseSchema.parse(sample).course.id).toBe("rizal");
  });

  it("rejects a node missing status", () => {
    const bad = structuredClone(sample);
    // @ts-expect-error intentional
    delete bad.sections[0].nodes[0].status;
    expect(() => pathResponseSchema.parse(bad)).toThrow();
  });
});
