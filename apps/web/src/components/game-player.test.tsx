import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeAttemptDraft, type AttemptDraft } from "@/lib/attempt-draft";
import { GamePlayer } from "./game-player";
import type { AssessmentGame, AttemptInfo } from "@jose/shared";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/path-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/path-api")>("@/lib/path-api");
  return {
    ...actual,
    finishAttempt: vi.fn(),
    recordMiss: vi.fn(),
    evaluateAttempt: vi.fn(),
  };
});

const game: AssessmentGame = {
  type: "quiz",
  questions: [
    {
      id: "q1",
      prompt: "Year?",
      choices: [
        { id: "a", text: "1861" },
        { id: "b", text: "1896" },
      ],
    },
  ],
};

const attempt: AttemptInfo = {
  id: "attempt-1",
  contentRevision: "rev-1",
  mode: "assessment",
  status: "open",
};

const draft = (accountId: string): AttemptDraft => ({
  accountId,
  levelId: "level-1",
  moduleId: "mod-1",
  title: "Quiz",
  revision: "rev-1",
  clientAttemptId: "11111111-1111-4111-8111-111111111111",
  score: 1,
  maxScore: 1,
  stars: 3,
  misses: 0,
  answers: { type: "quiz", choices: [0] },
  status: "save-failed",
  updatedAt: Date.now(),
});

describe("GamePlayer save recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("restores an unsaved result for the signed-in student and hides another student's draft", () => {
    writeAttemptDraft(draft("student-a"));

    const { unmount } = render(
      <GamePlayer
        levelId="level-1"
        moduleId="mod-1"
        title="Quiz"
        game={game}
        attempt={attempt}
        accountId="student-a"
        hearts={5}
      />,
    );

    expect(screen.getByRole("button", { name: /retry saving/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /play again/i })).toBeTruthy();

    unmount();
    render(
      <GamePlayer
        levelId="level-1"
        moduleId="mod-1"
        title="Quiz"
        game={game}
        attempt={attempt}
        accountId="student-b"
        hearts={5}
      />,
    );
    expect(screen.queryByRole("button", { name: /retry saving/i })).toBeNull();
  });
});
