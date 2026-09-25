import { describe, expect, it } from "vitest";
import {
  classRosterResponseSchema,
  csvSafeCell,
  gradebookResponseSchema,
  MAX_GRADED_ATTEMPTS,
  finalGradedAttempt,
  moduleFinalScore,
} from "./classroom";

describe("gradebook contracts", () => {
  it("requires admissionEmail and revision metadata on every row", () => {
    const parsed = gradebookResponseSchema.safeParse({
      classId: "c1",
      assignments: [
        {
          id: "a1",
          classId: "c1",
          moduleId: "m1",
          moduleTitle: "Propaganda",
          contentRevisionId: "r1",
          revisionNumber: 2,
          dueAt: null,
          assignedAt: 1000,
          archivedAt: null,
          members: [
            {
              learnerId: "u1",
              displayName: "Stu",
              admissionEmail: "stu@student.apc.edu.ph",
              membership: "active",
              status: "completed",
              progress: "2/2",
              completedCount: 2,
              totalCount: 2,
              masteryPercent: 80,
              bestScore: "8 / 10 (80%)",
              bestNumerator: 8,
              bestDenominator: 10,
              latestScore: "6 / 10 (60%)",
              latestNumerator: 6,
              latestDenominator: 10,
              latestAttemptAt: "2026-09-01T00:00:00.000Z",
              assignedRevisionId: "r1",
              revisionNumber: 2,
              assignmentState: "active",
              joinedAt: "2026-08-01T00:00:00.000Z",
              archivedAt: null,
            },
          ],
          counts: { notStarted: 0, inProgress: 0, completed: 1 },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("guards formula injection chars", () => {
    expect(csvSafeCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(csvSafeCell("+1+1")).toBe("'+1+1");
    expect(csvSafeCell("-2")).toBe("'-2");
    expect(csvSafeCell("@evil")).toBe("'@evil");
    expect(csvSafeCell("\tindented")).toBe("'\tindented");
    // Mid-string CR is quoted (line-break safe); leading =,+,-,@,tab,CR get formula guard.
    expect(csvSafeCell("a\rb")).toBe('"a\rb"');
    expect(csvSafeCell("\rfoo").startsWith("\"'")).toBe(true);
  });

  it("rejects roster rows without email", () => {
    const parsed = classRosterResponseSchema.safeParse({
      classId: "c1",
      members: [
        {
          learnerId: "u1",
          displayName: "Stu",
          joinedAt: 1,
          membership: "active",
        },
      ],
      nextCursor: null,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("moduleFinalScore", () => {
  const row = (levelId: string, score: number, createdAt: number) => ({
    levelId,
    score,
    maxScore: 10,
    createdAt,
  });

  it("sums each game's final attempt across the module", () => {
    expect(
      moduleFinalScore([row("a", 5, 1), row("b", 10, 2), row("c", 7, 3)]),
    ).toEqual({ score: 22, maxScore: 30 });
  });

  it("uses the second attempt as final and ignores attempts past the cap", () => {
    expect(
      moduleFinalScore([row("a", 9, 1), row("a", 4, 2), row("a", 10, 3)]),
    ).toEqual({ score: 4, maxScore: 10 });
    expect(finalGradedAttempt([row("a", 6, 1)])?.score).toBe(6);
    expect(MAX_GRADED_ATTEMPTS).toBe(2);
  });

  it("counts unplayed games as zero out of their max", () => {
    expect(
      moduleFinalScore([row("a", 5, 1)], new Map([["a", 10], ["b", 10]])),
    ).toEqual({ score: 5, maxScore: 20 });
    expect(moduleFinalScore([])).toBeNull();
  });
});
