import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeachClassesClient } from "./teach-classes-client";
import type { ClassRosterResponse, GradebookResponse } from "@jose/shared";

afterEach(() => {
  cleanup();
});

const gradebook: GradebookResponse = {
  classId: "c1",
  nextCursor: "a2",
  assignments: [
    {
      id: "a1",
      classId: "c1",
      moduleId: "m1",
      moduleTitle: "M1",
      title: "M1",
      contentRevisionId: "r1",
      revisionNumber: 1,
      dueAt: null,
      dueTimezone: "Asia/Manila",
      gradingPolicy: "best",
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
          effectiveScore: "8 / 10 (80%)",
          effectiveNumerator: 8,
          effectiveDenominator: 10,
          gradingPolicy: "best",
          isOverridden: false,
          overrideReason: null,
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
      title: "M1 retry",
      contentRevisionId: "r2",
      revisionNumber: 2,
      dueAt: null,
      dueTimezone: "Asia/Manila",
      gradingPolicy: "best",
      assignedAt: 2,
      archivedAt: 3,
      members: [],
      counts: { notStarted: 0, inProgress: 0, completed: 0 },
    },
  ],
};

const roster: ClassRosterResponse = {
  classId: "c1",
  members: [
    {
      learnerId: "u1",
      displayName: "Ana",
      admissionEmail: "ana@student.apc.edu.ph",
      joinedAt: "2026-08-01T00:00:00.000Z",
      membership: "active",
      archivedAt: null,
    },
  ],
  nextCursor: null,
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
        initialRoster={{ c1: roster }}
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
    expect(screen.getAllByText("ana@student.apc.edu.ph").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Download CSV/i).length).toBe(2);
    // Required gradebook columns per spec.
    expect(screen.getAllByText("APC email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Best assessed score").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Latest assessed score").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /load more assignments/i })).toBeInTheDocument();
    expect(screen.getByText(/Roster · 1 members/)).toBeInTheDocument();
  });

  it("renders roster for zero-assignment classes", () => {
    const emptyGradebook: GradebookResponse = {
      classId: "c2",
      assignments: [],
      nextCursor: null,
    };
    render(
      <TeachClassesClient
        initial={[
          {
            id: "c2",
            name: "Empty",
            inviteCode: null,
            memberCount: 1,
            challengesEnabled: false,
            archivedAt: null,
            createdAt: 1,
          },
        ]}
        modules={[]}
        initialGradebook={{ c2: emptyGradebook }}
        initialRoster={{ c2: { ...roster, classId: "c2" } }}
        initialError={null}
      />,
    );
    expect(screen.getByText(/Roster · 1 members/)).toBeInTheDocument();
    expect(screen.getAllByText("ana@student.apc.edu.ph").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
  });

  it("loads more assignments via cursor", async () => {
    const first: GradebookResponse = {
      classId: "c1",
      assignments: [gradebook.assignments[0]!],
      nextCursor: "a1",
    };
    const second: GradebookResponse = {
      classId: "c1",
      assignments: [gradebook.assignments[1]!],
      nextCursor: null,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => second,
      } as Response);
    try {
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
          initialGradebook={{ c1: first }}
          initialRoster={{ c1: roster }}
          initialError={null}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /load more assignments/i }));
      const found = await screen.findAllByText((_, el) =>
        (el?.textContent?.includes("M1 retry") ?? false),
      );
      expect(found.length).toBeGreaterThan(0);
      expect(fetchMock).toHaveBeenCalled();
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cursor=a1");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("loads every roster member via cursor, including zero-assignment classes", async () => {
    const firstRoster: ClassRosterResponse = {
      classId: "c2",
      members: [roster.members[0]!],
      nextCursor: "u1",
    };
    const secondRoster: ClassRosterResponse = {
      classId: "c2",
      members: [
        {
          learnerId: "u2",
          displayName: "Ben",
          admissionEmail: "ben@student.apc.edu.ph",
          joinedAt: "2026-08-02T00:00:00.000Z",
          membership: "active",
          archivedAt: null,
        },
      ],
      nextCursor: null,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => secondRoster,
    } as Response);
    try {
      render(
        <TeachClassesClient
          initial={[
            {
              id: "c2",
              name: "Empty",
              inviteCode: null,
              memberCount: 2,
              challengesEnabled: false,
              archivedAt: null,
              createdAt: 1,
            },
          ]}
          modules={[]}
          initialGradebook={{ c2: { classId: "c2", assignments: [], nextCursor: null } }}
          initialRoster={{ c2: firstRoster }}
          initialError={null}
        />,
      );
      expect(screen.getByRole("button", { name: /load more roster/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /load more roster/i }));
      const found = await screen.findByText("ben@student.apc.edu.ph");
      expect(found).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalled();
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cursor=u1");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/roster");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("shows assignment title, due timezone, policy, effective and override state", () => {
    const withPolicy: GradebookResponse = {
      classId: "c1",
      nextCursor: null,
      assignments: [
        {
          ...gradebook.assignments[0]!,
          title: "Week 1 · Propaganda",
          dueAt: Date.UTC(2026, 8, 15, 15, 59, 0),
          dueTimezone: "Asia/Manila",
          gradingPolicy: "best",
          members: [
            {
              ...gradebook.assignments[0]!.members[0]!,
              effectiveScore: "8 / 10 (80%)",
              gradingPolicy: "best",
              isOverridden: false,
              overrideReason: null,
            },
          ],
        },
      ],
    };
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
        initialGradebook={{ c1: withPolicy }}
        initialRoster={{ c1: roster }}
        initialError={null}
      />,
    );
    expect(screen.getByText("Week 1 · Propaganda")).toBeInTheDocument();
    expect(screen.getByText(/Timezone: Asia\/Manila/)).toBeInTheDocument();
    expect(screen.getByText(/Policy: best/)).toBeInTheDocument();
    expect(screen.getAllByText("Effective score").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Calculated").length).toBeGreaterThan(0);
  });
});
