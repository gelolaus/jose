import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudentChallengeListItem, StudentChallengeView } from "@jose/shared";
import { ClassChallengeBoard } from "./class-challenge-board";
import { TeachChallengesPanel } from "./teach-challenges-panel";

afterEach(() => {
  cleanup();
});

const listItem: StudentChallengeListItem = {
  id: "c1",
  classId: "class-1",
  className: "RIZLIFE-1",
  kind: "evidence_collection",
  title: "Shared evidence",
  participation: "available",
  displayMode: "alias",
  alias: null,
};

const view: StudentChallengeView = {
  id: "c1",
  classId: "class-1",
  className: "RIZLIFE-1",
  kind: "evidence_collection",
  title: "Shared evidence",
  prompt: "Add a unique source when you can. You do not need to be online together.",
  participation: "opted_in",
  displayMode: "alias",
  alias: "Lantern 11",
  progress: {
    uniqueEvidenceCount: 1,
    goalCount: 4,
    goalReached: false,
    myAcceptedCount: 1,
  },
  contributors: [
    { label: "Lantern 11", evidenceTitle: "Noli preface", recognition: "new_source" },
  ],
  myPending: [],
  myRecognitions: ["first_contribution", "new_source"],
  myTeam: null,
};

describe("ClassChallengeBoard", () => {
  it("treats challenges as optional and never ranks XP or missing classmates", () => {
    render(
      <ClassChallengeBoard
        items={[{ ...listItem, participation: "opted_in", alias: "Lantern 11" }]}
        selected={view}
        error={null}
        joining={false}
        onJoinClass={vi.fn()}
        onSelect={vi.fn()}
        onOptIn={vi.fn()}
        onContribute={vi.fn()}
        onSetDisplayMode={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /class challenges/i })).toBeTruthy();
    expect(screen.getByText(/optional cooperative/i)).toBeTruthy();
    expect(screen.getAllByText(/do not need to be online together/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lantern 11/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 of 4 unique sources/i)).toBeTruthy();
    expect(screen.queryByText(/leaderboard/i)).toBeNull();
    expect(screen.queryByText(/hasn't started/i)).toBeNull();
    expect(screen.queryByText(/slowest/i)).toBeNull();
    expect(screen.queryByRole("textbox", { name: /chat/i })).toBeNull();
  });

  it("asks students to opt in instead of auto-enrolling the class", () => {
    render(
      <ClassChallengeBoard
        items={[listItem]}
        selected={null}
        error={null}
        joining={false}
        onJoinClass={vi.fn()}
        onSelect={vi.fn()}
        onOptIn={vi.fn()}
        onContribute={vi.fn()}
        onSetDisplayMode={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^opt in$/i })).toBeTruthy();
    expect(screen.queryByText(/required assignment/i)).toBeNull();
  });
});

describe("TeachChallengesPanel", () => {
  it("lets teachers disable challenges and moderate without public XP rankings", () => {
    render(
      <TeachChallengesPanel
        classId="class-1"
        className="RIZLIFE-1"
        challengesEnabled={true}
        summaries={[
          {
            id: "c1",
            classId: "class-1",
            kind: "evidence_collection",
            title: "Shared evidence",
            goalCount: 4,
            enabled: true,
            archivedAt: null,
            createdAt: 1,
            participantCount: 2,
            uniqueEvidenceCount: 1,
          },
        ]}
        detail={null}
        onToggleEnabled={vi.fn()}
        onCreate={vi.fn()}
        onSelect={vi.fn()}
        onCreateTeam={vi.fn()}
        onAssignMember={vi.fn()}
        onModerate={vi.fn()}
      />,
    );

    expect(screen.getByRole("switch", { name: /cooperative challenges/i })).toBeTruthy();
    expect(screen.getByText(/students use aliases/i)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /chat/i })).toBeNull();
  });
});
