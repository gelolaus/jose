import { describe, expect, it } from "vitest";
import { attemptBodySchema } from "./modules";
import { finishAttemptBodySchema } from "./assessment";
import { MAX_ATTEMPT_PAYLOAD_BYTES, MAX_LESSON_MARKDOWN_CHARS } from "./limits";
import { paginateInMemory } from "./pagination";
import { lessonContentSchema } from "./games";

describe("payload bounds", () => {
  it("rejects oversized attempt payloads", () => {
    const payload = { blob: "x".repeat(MAX_ATTEMPT_PAYLOAD_BYTES + 10) };
    const parsed = attemptBodySchema.safeParse({ payload });
    expect(parsed.success).toBe(false);
  });

  it("accepts compact attempt payloads", () => {
    const parsed = attemptBodySchema.safeParse({
      payload: { events: ["a"] },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects oversized finish bodies", () => {
    const parsed = finishAttemptBodySchema.safeParse({
      answers: { type: "blank", words: ["x".repeat(MAX_ATTEMPT_PAYLOAD_BYTES)] },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects oversized lesson markdown", () => {
    const parsed = lessonContentSchema.safeParse({
      markdown: "m".repeat(MAX_LESSON_MARKDOWN_CHARS + 1),
      youtubeVideoId: null,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("pagination", () => {
  it("pages with cursors", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const first = paginateInMemory(items, { limit: 2 }, (item) => item.id);
    expect(first.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(first.nextCursor).toBe("b");
    const second = paginateInMemory(
      items,
      { limit: 2, cursor: "b" },
      (item) => item.id,
    );
    expect(second.items.map((i) => i.id)).toEqual(["c"]);
    expect(second.nextCursor).toBeNull();
  });
});
