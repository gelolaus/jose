import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseGameContent, type MemoryGame as MemoryContent } from "@jose/shared";
import { MemoryGame } from "./memory-game";

const learningGame = parseGameContent({
  type: "memory",
  playMode: "learning",
  pairs: [
    {
      id: "pair-1",
      a: { text: "Paris" },
      b: { text: "Eye doctor" },
      explanation: "Paris trained his eyes.",
    },
    {
      id: "pair-2",
      a: { text: "Berlin" },
      b: { text: "Noli, 1887" },
      explanation: "Noli was printed in Berlin.",
    },
  ],
}) as MemoryContent;

const timedGame = parseGameContent({
  type: "memory",
  playMode: "timed",
  timing: { secondsPerPair: 8, mismatchPenaltyMs: 3000 },
  pairs: learningGame.pairs,
}) as MemoryContent;

function play(game: MemoryContent = learningGame) {
  const onMiss = vi.fn(async () => "ok" as const);
  const onFinish = vi.fn();
  render(
    <MemoryGame game={game} disabled={false} onMiss={onMiss} onFinish={onFinish} />,
  );
  return { onMiss, onFinish };
}

function tap(id: string) {
  const button = document.querySelector(`[data-card-id="${id}"]`);
  if (!button) throw new Error(`missing card ${id}`);
  fireEvent.click(button);
}

describe("MemoryGame play", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("announces revealed card content for screen readers", async () => {
    play();
    await vi.advanceTimersByTimeAsync(0);
    tap("pair-1-a");
    expect(screen.getByRole("button", { name: "Revealed: Paris" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Hidden card" })).toHaveLength(3);
  });

  it("plays learning mode without a timer and does not spend a heart on a mismatch", async () => {
    const { onMiss } = play(learningGame);
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText(/untimed/i)).toBeTruthy();
    tap("pair-1-a");
    tap("pair-2-a");
    await vi.advanceTimersByTimeAsync(800);
    expect(onMiss).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/seconds left/i)).toBeNull();
  });

  it("starts the clock on the first flip in timed mode and times out with a held miss", async () => {
    const { onMiss, onFinish } = play(timedGame);
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText("0:16")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(screen.getByText("0:16")).toBeTruthy();
    tap("pair-1-a");
    await vi.advanceTimersByTimeAsync(16_000);
    expect(onMiss).toHaveBeenCalledWith(null, { hold: true });
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Time’s up" })).toBeTruthy();
  });

  it("finishes learning mode with mismatch count and never calls onMiss", async () => {
    const { onMiss, onFinish } = play(learningGame);
    await vi.advanceTimersByTimeAsync(0);
    tap("pair-1-a");
    tap("pair-2-a");
    await vi.advanceTimersByTimeAsync(800);
    tap("pair-1-a");
    tap("pair-1-b");
    tap("pair-2-a");
    tap("pair-2-b");
    expect(onMiss).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledWith(1, 2, 1);
  });
});
