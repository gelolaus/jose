import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryGame as MemoryContent } from "@jose/shared";
import { MemoryGame } from "./memory-game";

const game: MemoryContent = {
  type: "memory",
  pairs: [
    { a: { text: "Paris" }, b: { text: "Eye doctor" }, why: "Paris trained his eyes." },
    { a: { text: "Berlin" }, b: { text: "Noli, 1887" } },
  ],
};

function play() {
  const onMiss = vi.fn(async () => "ok" as const);
  const onFinish = vi.fn();
  render(
    <MemoryGame game={game} disabled={false} onMiss={onMiss} onFinish={onFinish} />,
  );
  return { onMiss, onFinish };
}

function tap(id: string) {
  fireEvent.click(screen.getByRole("button", { name: `Card ${id}` }));
}

describe("MemoryGame play", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not spend a heart on a mismatch", async () => {
    const { onMiss } = play();
    tap("0-a");
    tap("1-a");
    await vi.advanceTimersByTimeAsync(800);
    expect(onMiss).not.toHaveBeenCalled();
    expect(screen.getByText("0:13")).toBeTruthy();
  });

  it("starts the clock on the first flip and times out with a held miss", async () => {
    const { onMiss, onFinish } = play();
    expect(screen.getByText("0:16")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(screen.getByText("0:16")).toBeTruthy();
    tap("0-a");
    await vi.advanceTimersByTimeAsync(16_000);
    expect(onMiss).toHaveBeenCalledWith(null, { hold: true });
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Time’s up" })).toBeTruthy();
  });

  it("finishes with mismatch count and never calls onMiss", async () => {
    const { onMiss, onFinish } = play();
    tap("0-a");
    tap("1-a");
    await vi.advanceTimersByTimeAsync(800);
    tap("0-a");
    tap("0-b");
    tap("1-a");
    tap("1-b");
    expect(onMiss).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledWith(
      1,
      2,
      1,
      expect.objectContaining({
        type: "memory",
        matches: expect.arrayContaining([
          expect.objectContaining({ cardA: "0-a", cardB: "0-b" }),
          expect.objectContaining({ cardA: "1-a", cardB: "1-b" }),
        ]),
      }),
    );
  });
});
