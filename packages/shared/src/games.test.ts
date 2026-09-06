import { describe, expect, it } from "vitest";
import {
  blankGameSchema,
  countBlanks,
  emptyGameContent,
  gameContentSchema,
  memoryGameSchema,
  memoryScore,
  normalizeBlankKey,
  parseGameContent,
  quizGameSchema,
  scoreQuizRationale,
} from "./games";
import { MOTION, feedbackHoldMs, motionDurationMs } from "./motion";

describe("gameContentSchema", () => {
  it("accepts a valid quiz", () => {
    const parsed = gameContentSchema.parse({
      type: "quiz",
      questions: [
        {
          id: "q1",
          prompt: "Where was Rizal born?",
          choices: [
            { id: "a", text: "Calamba" },
            { id: "b", text: "Manila" },
          ],
          correctChoiceId: "a",
        },
      ],
    });
    expect(parsed.type).toBe("quiz");
  });

  it("rejects memory with fewer than two pairs", () => {
    expect(() =>
      memoryGameSchema.parse({
        type: "memory",
        pairs: [{ id: "p1", a: { text: "A" }, b: { text: "B" } }],
      }),
    ).toThrow();
  });

  it("builds a valid empty template for each type", () => {
    for (const type of ["quiz", "memory", "timeline", "blank", "sort"] as const) {
      expect(gameContentSchema.parse(emptyGameContent(type)).type).toBe(type);
    }
  });

  it("coerces legacy timeline string lists", () => {
    const parsed = parseGameContent({
      type: "timeline",
      items: ["Born in Calamba", "School in Biñan"],
    });
    expect(parsed.type).toBe("timeline");
    if (parsed.type !== "timeline") throw new Error("expected timeline");
    expect(parsed.items[0]?.label).toBe("Born in Calamba");
    expect(parsed.items[0]?.id).toBe("event-1");
  });

  it("coerces legacy quiz string choices into stable ids", () => {
    const parsed = parseGameContent({
      type: "quiz",
      questions: [
        {
          prompt: "Where was Rizal born?",
          choices: ["Calamba", "Manila"],
          correctIndex: 0,
          why: "Calamba.",
        },
      ],
    });
    expect(parsed.type).toBe("quiz");
    if (parsed.type !== "quiz") throw new Error("expected quiz");
    expect(parsed.questions[0]?.choices[0]?.id).toBe("q1-c1");
    expect(parsed.questions[0]?.correctChoiceId).toBe("q1-c1");
  });

  it("coerces legacy memory pairs with generated ids and learning mode", () => {
    const parsed = parseGameContent({
      type: "memory",
      pairs: [
        { a: { text: "Paris" }, b: { text: "Eye training" }, why: "Paris." },
        { a: { text: "Berlin" }, b: { text: "Noli printed" } },
      ],
    });
    expect(parsed.type).toBe("memory");
    if (parsed.type !== "memory") throw new Error("expected memory");
    expect(parsed.playMode).toBe("learning");
    expect(parsed.pairs[0]?.id).toBe("pair-1");
  });
});

describe("evidence duel schema", () => {
  it("accepts a five-question pilot mixing recall and evidence", () => {
    const parsed = quizGameSchema.parse({
      type: "quiz",
      questions: [
        {
          id: "r1",
          kind: "recall",
          prompt: "Where did Rizal study before Manila?",
          choices: [
            { id: "binan", text: "Biñan" },
            { id: "dapitan", text: "Dapitan" },
          ],
          correctChoiceId: "binan",
          whyCorrect: "Biñan came first.",
          objectiveTags: ["education", "recall"],
        },
        {
          id: "e1",
          kind: "evidence",
          prompt: "Which source best supports the claim?",
          claim: "Rizal’s novels criticized friar power without calling for a carnival.",
          sources: [
            {
              id: "s1",
              label: "Noli dedication excerpt",
              excerpt: "I will strive to answer the calumnies…",
              citation: "Noli Me Tangere, dedication",
            },
            {
              id: "s2",
              label: "Travel postcard",
              excerpt: "Weather fine in Berlin.",
              citation: "Unrelated note",
            },
          ],
          choices: [
            { id: "s1", text: "Noli dedication excerpt" },
            { id: "s2", text: "Travel postcard" },
          ],
          correctChoiceId: "s1",
          rationales: [
            { id: "r-strong", text: "It directly addresses colonial calumnies.", correct: true },
            { id: "r-weak", text: "Any European note proves the claim." },
          ],
          correctRationaleId: "r-strong",
          whyCorrect: "The dedication is primary literary evidence for the reform purpose.",
          objectiveTags: ["novels", "evidence"],
        },
        {
          id: "r2",
          kind: "recall",
          prompt: "Which honor word marked top Ateneo grades?",
          choices: [
            { id: "sob", text: "Sobresaliente" },
            { id: "cum", text: "Cum laude" },
          ],
          correctChoiceId: "sob",
          objectiveTags: ["ateneo", "recall"],
        },
        {
          id: "e2",
          kind: "evidence",
          prompt: "Strongest evidence that Berlin matters to Noli’s publication?",
          claim: "Noli Me Tangere was printed in Berlin in 1887.",
          sources: [
            {
              id: "print",
              label: "1887 Berlin imprint note",
              citation: "Publication record",
            },
            {
              id: "lunch",
              label: "Menu from a café",
              citation: "Unrelated",
            },
          ],
          choices: [
            { id: "print", text: "1887 Berlin imprint note" },
            { id: "lunch", text: "Menu from a café" },
          ],
          correctChoiceId: "print",
          objectiveTags: ["novels", "evidence"],
        },
        {
          id: "r3",
          kind: "recall",
          prompt: "Why leave UST for Madrid?",
          choices: [
            { id: "bad", text: "Filipino students were treated badly" },
            { id: "fire", text: "The school burned down" },
          ],
          correctChoiceId: "bad",
          objectiveTags: ["education", "recall"],
        },
      ],
    });
    const kinds = parsed.questions.map((q) => q.kind);
    expect(kinds.filter((k) => k === "recall")).toHaveLength(3);
    expect(kinds.filter((k) => k === "evidence")).toHaveLength(2);
  });

  it("scores structured rationales deterministically", () => {
    const question = quizGameSchema.parse({
      type: "quiz",
      questions: [
        {
          id: "e1",
          kind: "evidence",
          prompt: "Pick evidence",
          sources: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
          choices: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
          correctChoiceId: "a",
          rationales: [
            { id: "yes", text: "Direct support", correct: true },
            { id: "no", text: "Guess" },
          ],
          correctRationaleId: "yes",
        },
      ],
    }).questions[0]!;
    expect(scoreQuizRationale(question, "yes")).toEqual({ scored: true, correct: true });
    expect(scoreQuizRationale(question, "no")).toEqual({ scored: true, correct: false });
  });
});

describe("blank validation", () => {
  it("counts exactly one blank and normalizes accent duplicates", () => {
    expect(countBlanks("Born in ___.")).toBe(1);
    expect(countBlanks("No blank")).toBe(0);
    expect(normalizeBlankKey("Bagumbayán!")).toBe(normalizeBlankKey("bagumbayan"));
  });

  it("lets drafts store colliding decoys so publish can flag them", () => {
    const parsed = blankGameSchema.parse({
      type: "blank",
      items: [
        {
          sentence: "He was born in ___.",
          answer: "Calamba",
          decoys: ["Calamba", "Manila"],
        },
      ],
    });
    expect(parsed.items[0]?.decoys).toContain("Calamba");
  });
});

describe("memoryScore", () => {
  it("starts at pairs * 100 and subtracts 10 per mismatch", () => {
    expect(memoryScore(4, 0)).toEqual({ score: 400, maxScore: 400 });
    expect(memoryScore(4, 3)).toEqual({ score: 370, maxScore: 400 });
    expect(memoryScore(2, 50)).toEqual({ score: 0, maxScore: 200 });
  });
});

describe("motion tokens", () => {
  it("keeps control and screen durations inside the agreed bands", () => {
    expect(MOTION.controlMs).toBeGreaterThanOrEqual(MOTION.controlMsMin);
    expect(MOTION.controlMs).toBeLessThanOrEqual(MOTION.controlMsMax);
    expect(MOTION.screenMs).toBeGreaterThanOrEqual(MOTION.screenMsMin);
    expect(MOTION.screenMs).toBeLessThanOrEqual(MOTION.screenMsMax);
  });

  it("collapses motion under reduced-motion preference", () => {
    expect(motionDurationMs("control", true)).toBe(0);
    expect(feedbackHoldMs(true)).toBe(0);
    expect(feedbackHoldMs(false)).toBe(MOTION.feedbackHoldMs);
  });
});
