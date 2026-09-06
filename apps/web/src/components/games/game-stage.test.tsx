import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhySheet } from "./game-stage";

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
  });
});
