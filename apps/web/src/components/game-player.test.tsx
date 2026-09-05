import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizGame as QuizContent } from "@jose/shared";
import { GamePlayer } from "./game-player";
import { contentRevision, writeAttemptDraft } from "@/lib/attempt-draft";
import { CLIENT_ACCOUNT_STORAGE_KEY } from "@/lib/client-account";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const submitAttempt = vi.fn();
const recordMiss = vi.fn();

vi.mock("@/lib/path-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/path-api")>(
    "@/lib/path-api",
  );
  return {
    ...actual,
    submitAttempt: (...args: unknown[]) => submitAttempt(...args),
    recordMiss: (...args: unknown[]) => recordMiss(...args),
  };
});

const game: QuizContent = {
  type: "quiz",
  questions: [
    {
      prompt: "Where was Rizal born?",
      choices: ["Calamba", "Manila"],
      correctIndex: 0,
      why: "He was born in Calamba.",
    },
  ],
};

function renderPlayer() {
  return render(
    <GamePlayer
      levelId="ateneo-quiz"
      moduleId="ateneo-days"
      title="Ateneo quiz"
      game={game}
      hearts={5}
    />,
  );
}

describe("GamePlayer save recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLIENT_ACCOUNT_STORAGE_KEY, "acct-a");
    submitAttempt.mockReset();
    recordMiss.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("keeps a completed result when save fails and offers Retry saving without restarting", async () => {
    submitAttempt.mockRejectedValueOnce(new Error("network down"));
    renderPlayer();

    fireEvent.click(screen.getByRole("button", { name: "Calamba" }));
    fireEvent.click(screen.getByRole("button", { name: "See stars" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not saved|could not save|unsaved/i);
    });
    expect(screen.getByText("Ateneo quiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry saving/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See stars" })).not.toBeInTheDocument();

    submitAttempt.mockResolvedValueOnce({
      completed: true,
      firstTime: true,
      learner: {
        id: "demo-student",
        displayName: "Demo",
        streak: 1,
        hearts: 5,
        xp: 10,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /retry saving/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
    expect(submitAttempt).toHaveBeenCalledTimes(2);
    const firstId = submitAttempt.mock.calls[0]![1].clientAttemptId;
    const secondId = submitAttempt.mock.calls[1]![1].clientAttemptId;
    expect(firstId).toBe(secondId);
    expect(firstId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("restores an unsaved draft after refresh for the same account and revision", async () => {
    const revision = contentRevision(game);
    writeAttemptDraft({
      accountId: "acct-a",
      levelId: "ateneo-quiz",
      moduleId: "ateneo-days",
      title: "Ateneo quiz",
      revision,
      clientAttemptId: "33333333-3333-4333-8333-333333333333",
      score: 1,
      maxScore: 1,
      stars: 3,
      misses: 0,
      status: "save-failed",
      updatedAt: Date.now(),
    });

    renderPlayer();

    expect(screen.getByRole("button", { name: /retry saving/i })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calamba" })).not.toBeInTheDocument();
  });

  it("does not restore another account's draft", () => {
    writeAttemptDraft({
      accountId: "acct-other",
      levelId: "ateneo-quiz",
      moduleId: "ateneo-days",
      title: "Ateneo quiz",
      revision: contentRevision(game),
      clientAttemptId: "44444444-4444-4444-8444-444444444444",
      score: 1,
      maxScore: 1,
      stars: 3,
      misses: 0,
      status: "save-failed",
      updatedAt: Date.now(),
    });

    renderPlayer();
    expect(screen.getByRole("button", { name: "Calamba" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry saving/i })).not.toBeInTheDocument();
  });

  it("marks miss sync failures instead of pretending they succeeded", async () => {
    recordMiss.mockRejectedValueOnce(new Error("offline"));
    renderPlayer();

    fireEvent.click(screen.getByRole("button", { name: "Manila" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not synced|could not save the miss|miss was not saved/i);
    });
  });
});
