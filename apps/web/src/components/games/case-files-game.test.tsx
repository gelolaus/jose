import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { emptyCaseFilesGame } from "@jose/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseFilesGame } from "./case-files-game";

describe("CaseFilesGame", () => {
  afterEach(() => cleanup());

  it("supports tagging evidence and submitting a case", async () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <CaseFilesGame
        game={emptyCaseFilesGame()}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.getByText(/case question/i)).toBeInTheDocument();
    const tagButtons = screen.getAllByRole("button", { name: /tag|in tray/i });
    fireEvent.click(tagButtons[0]!);
    fireEvent.click(tagButtons[1]!);
    fireEvent.click(
      screen.getByRole("radio", {
        name: /reasoned public persuasion/i,
      }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value:
          "These two sources show civic persuasion rather than a call to arms.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit case/i }));
    expect(onFinish).toHaveBeenCalled();
  });
});
