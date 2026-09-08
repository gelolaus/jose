import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGameContent, type QuizGame as QuizContent } from "@jose/shared";
import { QuizGame } from "./quiz-game";

const parsed = parseGameContent({
  type: "quiz",
  questions: [{ id: "q1", prompt: "Where was Rizal born?", choices: [{ id: "a", text: "Calamba" }, { id: "b", text: "Manila" }], correctChoiceId: "a", whyCorrect: "Rizal was born in Calamba." }],
});
if (parsed.type !== "quiz") throw new Error("expected quiz");
const game: QuizContent = { ...parsed, questions: parsed.questions.map((q) => ({ ...q, rationales: [{ id: "r1", text: "Legacy justification" }, { id: "r2", text: "Other justification" }], correctRationaleId: "r1" })) };

describe("QuizGame", () => {
  afterEach(cleanup);

  it("finishes after one answer even when a legacy rationale exists", async () => {
    const onFinish = vi.fn();
    render(<QuizGame game={game} onMiss={vi.fn(async () => "ok" as const)} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole("button", { name: "Calamba" }));
    expect(screen.queryByText("Legacy justification")).toBeNull();
    expect(screen.getByText("Rizal was born in Calamba.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "See stars" }));
    expect(onFinish).toHaveBeenCalledWith(1, 1, 0, { type: "quiz", choices: ["a"] });
  });

  it("waits for server grading before allowing the next question", async () => {
    let resolve!: (value: { correct: boolean; misses: number }) => void;
    const onEvaluate = vi.fn(() => new Promise<{ correct: boolean; misses: number }>((done) => { resolve = done; }));
    const onFinish = vi.fn();
    render(<QuizGame game={game} onEvaluate={onEvaluate} onMiss={vi.fn(async () => "ok" as const)} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole("button", { name: "Calamba" }));
    expect(screen.queryByRole("button", { name: "See stars" })).toBeNull();
    resolve({ correct: true, misses: 0 });
    await waitFor(() => expect(screen.getByRole("button", { name: "See stars" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "See stars" }));
    expect(onEvaluate).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(1, 1, 0, { type: "quiz", choices: ["a"] });
  });
});
