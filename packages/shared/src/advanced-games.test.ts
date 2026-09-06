import { describe, expect, it } from "vitest";
import {
  applyDapitanProject,
  canAfford,
  emptyCaseFilesGame,
  emptyDapitanGame,
  emptyDispatchesGame,
  emptyEditorialGame,
  gradeCaseFiles,
  gradeEditorial,
} from "./advanced-games";
import { emptyChestContent, parseChestContent } from "./artifacts";
import { emptyGameContent, gameContentSchema, pieceCount } from "./games";

describe("advanced game drafts", () => {
  it("builds valid empty templates for new types", () => {
    for (const type of [
      "case-files",
      "dispatches",
      "editorial",
      "dapitan",
    ] as const) {
      expect(gameContentSchema.parse(emptyGameContent(type)).type).toBe(type);
    }
  });

  it("keeps draft templates marked draft with teacher instructions", () => {
    expect(emptyCaseFilesGame().approvalStatus).toBe("draft");
    expect(emptyDispatchesGame().teacherInstructions.length).toBeGreaterThan(40);
    expect(emptyEditorialGame().acceptedStructures.length).toBeGreaterThan(1);
    expect(emptyDapitanGame().assumptionsNotice.toLowerCase()).toContain(
      "game assumption",
    );
  });
});

describe("gradeCaseFiles", () => {
  const game = emptyCaseFilesGame();

  it("rewards an accepted evidence combination with reasoning", () => {
    const result = gradeCaseFiles(game, {
      evidenceIds: ["src-a", "src-b"],
      conclusionId: "conc-reform",
      reasoning:
        "Sources A and B both show civic persuasion language rather than a call to arms.",
    });
    expect(result.ok).toBe(true);
    expect(result.matchedEvidence).toBe(true);
    expect(result.score).toBe(result.maxScore);
  });

  it("rejects indefensible conclusions even with sources selected", () => {
    const result = gradeCaseFiles(game, {
      evidenceIds: ["src-a", "src-b"],
      conclusionId: "conc-force",
      reasoning: "This conclusion is not supported by the curated pack at all.",
    });
    expect(result.ok).toBe(false);
    expect(result.conclusionDefensible).toBe(false);
    expect(result.score).toBeLessThan(result.maxScore);
  });
});

describe("gradeEditorial", () => {
  const game = emptyEditorialGame();

  it("accepts more than one defensible structure", () => {
    const a = gradeEditorial(game, {
      "slot-claim": "claim-a",
      "slot-evidence": "ev-a",
      "slot-counter": "counter-a",
      "slot-conclusion": "conc-a",
    });
    const b = gradeEditorial(game, {
      "slot-claim": "claim-b",
      "slot-evidence": "ev-b",
      "slot-counter": "counter-a",
      "slot-conclusion": "conc-b",
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("gives specific feedback for weak evidence", () => {
    const result = gradeEditorial(game, {
      "slot-claim": "claim-a",
      "slot-evidence": "ev-weak",
      "slot-counter": "counter-a",
      "slot-conclusion": "conc-a",
    });
    expect(result.ok).toBe(false);
    expect(result.weakPieceIds).toContain("ev-weak");
    expect(result.feedback.toLowerCase()).toMatch(/vague|mismatched|weak/);
  });
});

describe("dapitan resources", () => {
  it("exposes tradeoffs without crowning a best historical decision", () => {
    const game = emptyDapitanGame();
    const afterClinic = applyDapitanProject(
      game.startingResources,
      game.projects[0]!,
    );
    const afterSchool = applyDapitanProject(
      game.startingResources,
      game.projects[1]!,
    );
    expect(canAfford(game.startingResources, game.projects[0]!.cost)).toBe(true);
    expect(afterClinic.goodwill).not.toBe(afterSchool.goodwill);
    expect(game.debrief.historicalComparison.toLowerCase()).not.toContain(
      "best rizal decision",
    );
    expect(pieceCount(game)).toBe(game.turns);
  });
});

describe("chest artifacts", () => {
  it("requires a revisitable artifact with provenance", () => {
    const chest = parseChestContent(emptyChestContent());
    expect(chest.artifact.provenance.length).toBeGreaterThan(10);
    expect(chest.artifact.approvalStatus).toBe("draft");
    expect(chest.achievementCriteria.length).toBeGreaterThan(5);
  });
});
