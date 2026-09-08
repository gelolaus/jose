import { describe, expect, it } from "vitest";
import { emptyGameContent, simplifyGameContent, pieceCount, isPlayableGameContent } from "./games";
import { gradeAssessmentFinish, finishAnswersSchema } from "./assessment";
import { isActiveGameType } from "./path";

describe("simple game rules", () => {
  it("keeps legacy types readable but excludes them from active games", () => {
    expect(isActiveGameType("case-files")).toBe(false);
    expect(isActiveGameType("sort")).toBe(true);
  });
  it("grades timeline ordering without the legacy causal question", () => {
    const game = emptyGameContent("timeline");
    expect(simplifyGameContent(game)).not.toHaveProperty("causalLink");
    expect(pieceCount(game)).toBe(2);
    expect(gradeAssessmentFinish(game, { type: "timeline", order: ["event-1", "event-2"] }, 0).score).toBe(2);
  });
  it("removes discussion cards and rejects sorting rounds with too few cards", () => {
    const game = emptyGameContent("sort");
    if (game.type !== "sort") throw new Error("Expected sorting");
    const legacy = { ...game, items: game.items.map((item, index) => index === 0 ? { ...item, scoring: "discussion" as const } : item) };
    const simple = simplifyGameContent(legacy);
    expect(simple.type === "sort" && simple.items.every((item) => item.scoring !== "discussion")).toBe(true);
    expect(isPlayableGameContent({ ...game, items: [game.items[0]!] })).toBe(false);
  });
  it("gives matching full points despite mismatches and zero on timeout", () => {
    const game = emptyGameContent("memory");
    const secret = { memoryPairMap: { a: 0, b: 0, c: 1, d: 1 } };
    expect(gradeAssessmentFinish(game, { type: "memory", matches: [{ cardA: "a", cardB: "b" }, { cardA: "c", cardB: "d" }] }, 50, secret).score).toBe(2);
    const answers = finishAnswersSchema.parse({ type: "memory", matches: [], timedOut: true });
    expect(gradeAssessmentFinish(game, answers, 0, secret).score).toBe(0);
  });
});
