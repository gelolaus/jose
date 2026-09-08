import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MemoryGame as MemoryContent, type EvaluateEventResult } from "@jose/shared";
import { MemoryGame } from "./memory-game";
const game: MemoryContent = { type: "memory", playMode: "learning", pairs: [
  { id: "p1", a: { text: "Paris" }, b: { text: "France" } },
  { id: "p2", a: { text: "Berlin" }, b: { text: "Germany" } },
] };
const tap = (id: string) => fireEvent.click(document.querySelector(`[data-card-id="${id}"]`)!);
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function play(onEvaluate?: (event: import("@jose/shared").AttemptEvent) => Promise<EvaluateEventResult>) {
  const onMiss = vi.fn(async () => "ok" as const), onFinish = vi.fn();
  const view = render(<MemoryGame game={game} onMiss={onMiss} onFinish={onFinish} onEvaluate={onEvaluate} />);
  return { onMiss, onFinish, ...view };
}
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0.999); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("matching", () => {
  it("shows its timer before play and starts at the first card", async () => {
    const { onMiss, onFinish } = play();
    await advance(10_000);
    expect(screen.getByText("1:00")).toBeInTheDocument();
    tap("p1-a");
    expect(screen.getByRole("button", { name: "Revealed: Paris" })).toBeInTheDocument();
    await advance(60_000);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(0, 2, 2, { type: "memory", matches: [], timedOut: true });
    expect(onMiss).not.toHaveBeenCalled();
    await advance(5000);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
  it("gives full points despite mismatches and adds no time penalty", async () => {
    const { onMiss, onFinish } = play();
    await advance(0);
    tap("p1-a"); tap("p2-a");
    await advance(800);
    expect(screen.getByText("1:00")).toBeInTheDocument();
    tap("p1-a"); tap("p1-b"); tap("p2-a"); tap("p2-b");
    expect(onFinish).toHaveBeenCalledWith(2, 2, 0, expect.objectContaining({ type: "memory" }));
    expect(onMiss).not.toHaveBeenCalled();
  });
  it("starts assessment on first flip and ignores a match resolved after timeout", async () => {
    let resolve!: (value: EvaluateEventResult) => void;
    const evaluate = vi.fn().mockResolvedValueOnce({ correct: true, remainingMs: 1000 }).mockImplementationOnce(() => new Promise<EvaluateEventResult>(r => { resolve = r; }));
    const { onFinish } = play(evaluate);
    await advance(0);
    await act(async () => { tap("p1-a"); });
    expect(evaluate).toHaveBeenNthCalledWith(1, { type: "memory_start" });
    tap("p1-b");
    await advance(1000);
    await act(async () => resolve({ correct: true, misses: 0 }));
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(0, 2, 2, { type: "memory", matches: [], timedOut: true });
  });
  it("keeps build mode focused on pairs", () => {
    render(<MemoryGame game={game} mode="build" onChange={vi.fn()} />);
    expect(screen.queryByText(/untimed|timed challenge|mismatch penalty/i)).toBeNull();
    expect(screen.getByDisplayValue("Paris")).toBeInTheDocument();
  });
});
