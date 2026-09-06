import { describe, expect, it } from "vitest";
import {
  assessmentGameSchema,
  buildMemoryAssessment,
  evaluateBlankChoice,
  evaluateMemoryMatch,
  evaluateQuizChoice,
  evaluateSortCheck,
  evaluateTimelineCheck,
  gradeFromMisses,
  sanitizeGameForAssessment,
  stableStringify,
} from "./assessment";
import type { GameContent } from "./games";

const quiz: GameContent = {
  type: "quiz",
  questions: [
    {
      prompt: "Capital?",
      choices: ["Manila", "Cebu"],
      correctIndex: 0,
      why: "Manila is the capital.",
    },
  ],
};

describe("sanitizeGameForAssessment", () => {
  it("strips quiz answer keys", () => {
    const { play } = sanitizeGameForAssessment(quiz);
    expect(play.type).toBe("quiz");
    if (play.type !== "quiz") return;
    expect(play.questions[0]).toEqual({
      prompt: "Capital?",
      choices: ["Manila", "Cebu"],
    });
    expect(assessmentGameSchema.parse(play).type).toBe("quiz");
    expect(JSON.stringify(play)).not.toMatch(/correctIndex|why/);
  });

  it("strips blank answers into options", () => {
    const game: GameContent = {
      type: "blank",
      items: [
        {
          sentence: "Born in ___.",
          answer: "Calamba",
          decoys: ["Manila"],
          why: "Laguna",
        },
      ],
    };
    const { play } = sanitizeGameForAssessment(game);
    expect(play.type).toBe("blank");
    if (play.type !== "blank") return;
    expect(play.items[0]!.options.sort()).toEqual(["Calamba", "Manila"]);
    expect(play.items[0]).not.toHaveProperty("answer");
  });

  it("strips sort bucket ids", () => {
    const game: GameContent = {
      type: "sort",
      buckets: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      items: [
        { id: "i1", label: "One", bucketId: "a", why: "Because" },
        { id: "i2", label: "Two", bucketId: "b" },
      ],
    };
    const { play } = sanitizeGameForAssessment(game);
    expect(play.type).toBe("sort");
    if (play.type !== "sort") return;
    expect(play.items[0]).toEqual({ id: "i1", label: "One" });
    expect(JSON.stringify(play)).not.toMatch(/bucketId|"why"/);
  });

  it("builds opaque memory cards with a server pair map", () => {
    const game: GameContent = {
      type: "memory",
      pairs: [
        { a: { text: "A1" }, b: { text: "B1" }, why: "pair" },
        { a: { text: "A2" }, b: { text: "B2" } },
      ],
    };
    let n = 0;
    const { play, secret } = buildMemoryAssessment(game, () => `id-${++n}`);
    expect(play.cards).toHaveLength(4);
    expect(play.pairCount).toBe(2);
    expect(Object.keys(secret.memoryPairMap ?? {})).toHaveLength(4);
    expect(JSON.stringify(play)).not.toMatch(/pairId|why/);
  });
});

describe("server grading helpers", () => {
  it("grades quiz choices without trusting the client score", () => {
    expect(evaluateQuizChoice(quiz, 0, 0).correct).toBe(true);
    const miss = evaluateQuizChoice(quiz, 0, 1);
    expect(miss.correct).toBe(false);
    expect(miss.feedback?.title).toBe("Manila");
    expect(gradeFromMisses(quiz, 1)).toEqual({
      score: 0,
      maxScore: 1,
      stars: 2,
      misses: 1,
    });
  });

  it("grades blank, timeline, sort, and memory matches", () => {
    const blank: GameContent = {
      type: "blank",
      items: [{ sentence: "___", answer: "Rizal", decoys: ["Gomez"] }],
    };
    expect(evaluateBlankChoice(blank, 0, "rizal").correct).toBe(true);
    expect(evaluateBlankChoice(blank, 0, "Gomez").correct).toBe(false);

    const timeline: GameContent = {
      type: "timeline",
      items: [
        { id: "a", label: "First", why: "start" },
        { id: "b", label: "Second" },
      ],
    };
    expect(evaluateTimelineCheck(timeline, ["a", "b"]).perfect).toBe(true);
    expect(evaluateTimelineCheck(timeline, ["b", "a"]).perfect).toBe(false);

    const sort: GameContent = {
      type: "sort",
      buckets: [
        { id: "x", label: "X" },
        { id: "y", label: "Y" },
      ],
      items: [
        { id: "1", label: "One", bucketId: "x" },
        { id: "2", label: "Two", bucketId: "y" },
      ],
    };
    expect(evaluateSortCheck(sort, { "1": "x", "2": "y" }).perfect).toBe(true);
    expect(evaluateSortCheck(sort, { "1": "y", "2": "y" }).perfect).toBe(false);

    const map = { a: 0, b: 0, c: 1, d: 1 };
    expect(evaluateMemoryMatch(map, "a", "b", () => "yes").correct).toBe(true);
    expect(evaluateMemoryMatch(map, "a", "c", () => undefined).correct).toBe(false);
  });

  it("stableStringify is order-independent for revision hashing", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
});
