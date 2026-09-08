import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { emptyDispatchesGame } from "@jose/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DispatchesGame } from "./dispatches-game";

describe("DispatchesGame", () => {
  afterEach(() => cleanup());

  it("works from stacked stops without a tiny map", () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <DispatchesGame
        game={emptyDispatchesGame()}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.getAllByText(/choose the next stop/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /paris/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /paris/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /draft strong dispatch — replace/i }),
    );
    expect(screen.getAllByText(/continue the route|paris/i).length).toBeGreaterThan(0);
  });
});
