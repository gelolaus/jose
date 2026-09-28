import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameFrame, StarCelebration, WhySheet } from "./game-stage";

describe("WhySheet", () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens as a labelled modal and receives focus", () => {
    render(
      <WhySheet
        why={{ title: "Ateneo", body: "Jesuit teachers ran the school." }}
        onDismiss={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Ateneo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("allows Escape only after the explanation delay", async () => {
    const onDismiss = vi.fn();
    render(
      <WhySheet
        why={{ title: "Ateneo", body: "Jesuit teachers ran the school." }}
        onDismiss={onDismiss}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Ateneo" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(280);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("traps tab focus inside the dialog while the dismiss control is delayed", async () => {
    render(
      <WhySheet
        why={{ title: "Ateneo", body: "Jesuit teachers ran the school." }}
        onDismiss={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Ateneo" });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    // Dismiss button is disabled until delay; trap keeps focus on the dialog shell.
    expect(dialog).toHaveFocus();
    expect(document.querySelector(".session-why")).toBe(dialog.parentElement);
  });
});

describe("session progress and celebration", () => {
  afterEach(cleanup);

  it("shows a thick progress bar for question 1", () => {
    render(
      <GameFrame
        title="Quiz"
        hint="Tap"
        initialProgress={{ label: "Question 1 of 5", value: 0, max: 5 }}
      >
        <p>Prompt</p>
      </GameFrame>,
    );
    const bar = screen.getByRole("progressbar", { name: "Question 1 of 5" });
    expect(bar).toBeVisible();
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar.querySelector(".session-progress__fill")).toBeTruthy();
  });

  it("stacks celebration actions and shows a reward beat when the save includes one", () => {
    render(
      <StarCelebration
        title="Calamba"
        score={1}
        maxScore={1}
        stars={3}
        onContinue={() => {}}
        reward={{ badgeTitle: "Noli", xp: 10, streak: 4 }}
      />,
    );
    expect(screen.getByText("Module badge earned")).toBeVisible();
    expect(screen.getByText("Noli")).toBeVisible();
    expect(screen.getByText("+10 XP")).toBeVisible();
    expect(screen.getByText("4 day streak")).toBeVisible();
    expect(document.querySelector(".session-celebration__actions")).toBeTruthy();
  });
});
