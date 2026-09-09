import { describe, expect, it } from "vitest";
import {
  classRosterResponseSchema,
  csvSafeCell,
  gradebookResponseSchema,
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
