import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftAutosave } from "./use-draft-autosave";

describe("useDraftAutosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks dirty after edits following a successful save", async () => {
    const save = vi.fn(async () => ({ revision: 1 }));
    const { result, rerender } = renderHook(
      ({ value, revision }) =>
        useDraftAutosave({
          storageKey: "test-draft",
          value,
          revision,
          debounceMs: 200,
          save,
        }),
      { initialProps: { value: { title: "A" }, revision: 0 } },
    );

    rerender({ value: { title: "B" }, revision: 0 });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("dirty");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(save).toHaveBeenCalled();
    expect(result.current.status).toBe("saved");

    rerender({ value: { title: "C" }, revision: 1 });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("dirty");
  });

  it("keeps a recoverable local draft when save fails", async () => {
    const save = vi.fn(async () => {
      throw Object.assign(new Error("network down"), { code: "NETWORK" });
    });
    const { result, rerender } = renderHook(
      ({ value }) =>
        useDraftAutosave({
          storageKey: "fail-draft",
          value,
          revision: 0,
          debounceMs: 100,
          save,
        }),
      { initialProps: { value: { body: "draft-1" } } },
    );

    rerender({ value: { body: "draft-2" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(result.current.status).toBe("failed");
    const stored = window.localStorage.getItem("fail-draft");
    expect(stored).toContain("draft-2");
  });
});
