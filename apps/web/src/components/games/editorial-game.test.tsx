import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { emptyEditorialGame } from "@jose/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorialGame } from "./editorial-game";

describe("EditorialGame", () => {
  afterEach(() => cleanup());

  it("shows briefing and scoring preview that reject opinion scoring", () => {
    render(
      <EditorialGame
        game={emptyEditorialGame()}
        onMiss={vi.fn(async () => "ok" as const)}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getByText(/historical briefing/i)).toBeInTheDocument();
    expect(
      screen.getByText(/preferred modern political opinion/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check editorial/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/draft claim a/i));
    expect(screen.getByRole("button", { name: /put in claim/i })).toBeInTheDocument();
  });
});
