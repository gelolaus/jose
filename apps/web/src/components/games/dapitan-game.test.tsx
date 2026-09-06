import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { emptyDapitanGame } from "@jose/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DapitanGame } from "./dapitan-game";

describe("DapitanGame", () => {
  afterEach(() => cleanup());

  it("exposes tradeoffs, undo, and no mandatory timer", () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <DapitanGame
        game={emptyDapitanGame()}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.getByText(/game assumptions/i)).toBeInTheDocument();
    expect(screen.queryByText(/seconds left/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /clinic hours/i }));
    fireEvent.click(screen.getByRole("button", { name: /undo last choice/i }));
    expect(screen.getByText(/turn 1 of/i)).toBeInTheDocument();
  });
});
