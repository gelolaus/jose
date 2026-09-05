import { describe, expect, it, vi } from "vitest";
import { createPendingMap, runMutation } from "./teach-mutations";

describe("teach mutations", () => {
  it("returns failure without throwing and keeps caller input intact", async () => {
    const input = { title: "Keep me" };
    const result = await runMutation(async () => {
      throw new Error("add failed");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("add failed");
    }
    expect(input.title).toBe("Keep me");
  });

  it("prevents duplicate in-flight submits for the same operation key", async () => {
    const pending = createPendingMap();
    let releases!: () => void;
    const gate = new Promise<void>((resolve) => {
      releases = resolve;
    });
    const action = vi.fn(async () => {
      await gate;
      return "created";
    });

    const first = pending.run("add", action);
    const second = await pending.run("add", action);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toMatch(/already in progress/i);
    }
    releases();
    const done = await first;
    expect(done).toEqual({ ok: true, data: "created" });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
