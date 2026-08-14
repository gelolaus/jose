import { describe, expect, it } from "vitest";
import {
  emptyGameContent,
  gameContentSchema,
  memoryGameSchema,
  memoryScore,
} from "./games";

describe("gameContentSchema", () => {
  it("accepts a valid quiz", () => {
    const parsed = gameContentSchema.parse({
      type: "quiz",
      questions: [
        {
          prompt: "Where was Rizal born?",
          choices: ["Calamba", "Manila"],
          correctIndex: 0,
        },
      ],
    });
    expect(parsed.type).toBe("quiz");
  });

  it("rejects memory with fewer than two pairs", () => {
    expect(() =>
      memoryGameSchema.parse({
        type: "memory",
        pairs: [{ a: { text: "A" }, b: { text: "B" } }],
      }),
    ).toThrow();
  });

  it("builds a valid empty template for each type", () => {
    for (const type of ["quiz", "memory", "timeline", "blank", "sort"] as const) {
      expect(gameContentSchema.parse(emptyGameContent(type)).type).toBe(type);
    }
  });
});

describe("memoryScore", () => {
  it("starts at pairs * 100 and subtracts 10 per mismatch", () => {
    expect(memoryScore(4, 0)).toEqual({ score: 400, maxScore: 400 });
    expect(memoryScore(4, 3)).toEqual({ score: 370, maxScore: 400 });
    expect(memoryScore(2, 50)).toEqual({ score: 0, maxScore: 200 });
  });
});
