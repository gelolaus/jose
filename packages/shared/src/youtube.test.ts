import { describe, expect, it } from "vitest";
import { parseYoutubeVideoId } from "./youtube";

describe("parseYoutubeVideoId", () => {
  it("accepts a raw 11-character id", () => {
    expect(parseYoutubeVideoId("dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
  });

  it("parses watch, short, and embed URLs", () => {
    expect(
      parseYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9wgGcQ"),
    ).toBe("dQw4w9wgGcQ");
    expect(parseYoutubeVideoId("https://youtu.be/dQw4w9wgGcQ")).toBe(
      "dQw4w9wgGcQ",
    );
    expect(
      parseYoutubeVideoId("https://www.youtube.com/embed/dQw4w9wgGcQ"),
    ).toBe("dQw4w9wgGcQ");
  });

  it("returns null for empty or junk input", () => {
    expect(parseYoutubeVideoId("")).toBeNull();
    expect(parseYoutubeVideoId("https://example.com/watch?v=nope")).toBeNull();
  });
});
