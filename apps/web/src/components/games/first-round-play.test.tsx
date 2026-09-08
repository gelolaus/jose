import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emptyCaseFilesGame,
  emptyDapitanGame,
  emptyDispatchesGame,
  emptyEditorialGame,
} from "@jose/shared";
import { CaseFilesGame } from "./case-files-game";
import { DapitanGame } from "./dapitan-game";
import { DispatchesGame } from "./dispatches-game";
import { EditorialGame } from "./editorial-game";
import { QuizGame } from "./quiz-game";
import { parseGameContent } from "@jose/shared";

describe("advanced first-round play", () => {
  afterEach(() => cleanup());

  it("lets Case Files pick evidence by tap before tagging", async () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <CaseFilesGame
        game={emptyCaseFilesGame()}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.getAllByText(/read the claim/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/the claim/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/choose the strongest evidence/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /tag|in tray/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /draft source a/i }));
    expect(screen.getByText(/why this supports the claim/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next file/i }));
    expect(screen.getAllByRole("button", { name: /tag|in tray/i }).length).toBeGreaterThan(0);
  });

  it("lets Dispatches pick the next stop by tap before writing a dispatch", async () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <DispatchesGame
        game={emptyDispatchesGame()}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.getAllByText(/follow rizal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/current stop/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/where did he go next/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /draft strong dispatch/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /paris/i }));
    expect(screen.getByRole("button", { name: /draft strong dispatch — replace/i })).toBeInTheDocument();
  });

  it("lets Editorial Room place claim, evidence, and conclusion by tap", () => {
    render(
      <EditorialGame
        game={emptyEditorialGame()}
        onMiss={vi.fn(async () => "ok" as const)}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/put these three pieces in order/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/what are you saying/i)).toBeInTheDocument();
    expect(screen.getByText(/what evidence supports it/i)).toBeInTheDocument();
    expect(screen.getByText(/what should the reader understand/i)).toBeInTheDocument();
    expect(screen.queryByText(/scoring preview/i)).toBeNull();
    expect(screen.queryByText(/preferred modern political opinion/i)).toBeNull();

    fireEvent.click(screen.getByText(/draft claim a/i));
    fireEvent.click(screen.getByRole("button", { name: /put in claim/i }));
    expect(screen.getByText(/draft claim a/i)).toBeInTheDocument();
  });

  it("lets Dapitan Workshop make one community choice before resource allocation", () => {
    render(
      <DapitanGame
        game={emptyDapitanGame()}
        onMiss={vi.fn(async () => "ok" as const)}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/choose the action that best helps the community/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/the community needs/i)).toBeInTheDocument();
    expect(screen.queryByText(/turn 1 of/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /clinic hours/i }));
    expect(screen.getByText(/what will this help/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue the work/i }));
    expect(screen.getAllByText(/turn 2 of/i).length).toBeGreaterThan(0);
  });
});

describe("simple game how-to-play", () => {
  afterEach(() => cleanup());

  it("shows a how-to-play line on quiz", () => {
    const game = parseGameContent({
      type: "quiz",
      questions: [
        {
          id: "q1",
          prompt: "When was Rizal born?",
          choices: [
            { id: "a", text: "1861" },
            { id: "b", text: "1896" },
          ],
          correctChoiceId: "a",
        },
      ],
    });
    if (game.type !== "quiz") throw new Error("expected quiz");
    render(
      <QuizGame
        game={game}
        onMiss={vi.fn(async () => "ok" as const)}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByText(/how to play/i)).toBeInTheDocument();
  });
});
