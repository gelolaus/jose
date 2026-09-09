import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { TeachClassesClient } from "./teach-classes-client";
import type { GradebookResponse } from "@jose/shared";

const gradebook: GradebookResponse = {
  classId: "c1",
  assignments: [
    {
      id: "a1",
      classId: "c1",
      moduleId: "m1",
      moduleTitle: "M1",
      contentRevisionId: "r1",
      revisionNumber: 1,
      dueAt: null,
      assignedAt: 1,
      archivedAt: null,
      members: [
        {
          learnerId: "u1",
          displayName: "Ana",
          admissionEmail: "ana@student.apc.edu.ph",
          membership: "active",
          status: "completed",
          progress: "2/2",
          completedCount: 2,
          totalCount: 2,
          masteryPercent: 80,
          bestScore: "8 / 10 (80%)",
          bestNumerator: 8,
          bestDenominator: 10,
          latestScore: "8 / 10 (80%)",
          latestNumerator: 8,
          latestDenominator: 10,
          latestAttemptAt: "2026-09-01T00:00:00.000Z",
          assignedRevisionId: "r1",
          revisionNumber: 1,
          assignmentState: "active",
          joinedAt: "2026-08-01T00:00:00.000Z",
          archivedAt: null,
        },
      ],
      counts: { notStarted: 0, inProgress: 0, completed: 1 },
    },
    {
      id: "a2",
      classId: "c1",
      moduleId: "m1",
      moduleTitle: "M1 retry",
      contentRevisionId: "r2",
      revisionNumber: 2,
      dueAt: null,
      assignedAt: 2,
      archivedAt: 3,
      members: [],
      counts: { notStarted: 0, inProgress: 0, completed: 0 },
    },
  ],
};

describe("TeachClassesClient gradebook", () => {
  it("renders every assignment table with email and CSV action", () => {
    render(
      <TeachClassesClient
        initial={[
          {
            id: "c1",
            name: "R1",
            inviteCode: null,
            memberCount: 1,
            challengesEnabled: false,
            archivedAt: null,
            createdAt: 1,
          },
        ]}
        modules={[]}
        initialGradebook={{ c1: gradebook }}
        initialError={null}
      />,
    );
    // Titles are split across text nodes (title + " (archived)"), so match on textContent.
    expect(
      screen.getByText((_, el) => el?.textContent === "M1"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((_, el) => el?.textContent?.includes("M1 retry") ?? false)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("ana@student.apc.edu.ph")).toBeInTheDocument();
    expect(screen.getAllByText(/Download CSV/i).length).toBe(2);
    // Required gradebook columns per spec.
    expect(screen.getAllByText("APC email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Best assessed score").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Latest assessed score").length).toBeGreaterThan(0);
  });
});
