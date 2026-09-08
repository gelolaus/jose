import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { emptyDapitanGame } from "@jose/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DapitanGame } from "./dapitan-game";

describe("DapitanGame", () => {
  afterEach(() => cleanup());

  it("exposes tradeoffs after the first community choice, with undo and no timer", () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <DapitanGame
        game={emptyDapitanGame()}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.queryByText(/seconds left/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /clinic hours/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue the work/i }));
    fireEvent.click(screen.getByRole("button", { name: /undo last choice/i }));
    expect(screen.getAllByText(/choose an action|the community needs/i).length).toBeGreaterThan(0);
  });
});
