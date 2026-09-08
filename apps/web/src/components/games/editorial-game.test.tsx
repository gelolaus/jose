import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { emptyEditorialGame } from "@jose/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorialGame } from "./editorial-game";

describe("EditorialGame", () => {
  afterEach(() => cleanup());

  it("starts with three tap-first slots and hides scoring preview", () => {
    render(
      <EditorialGame
        game={emptyEditorialGame()}
        onMiss={vi.fn(async () => "ok" as const)}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/build the article/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/preferred modern political opinion/i)).toBeNull();
    expect(screen.getByRole("button", { name: /check the story/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/draft claim a/i));
    expect(screen.getByRole("button", { name: /put in claim/i })).toBeInTheDocument();
  });
});
