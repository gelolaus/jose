import { describe, expect, it } from "vitest";
import { describeLessonBlocksIssue, newBlockId } from "./lesson-blocks";

describe("describeLessonBlocksIssue", () => {
  it("allows an empty text block", () => {
    expect(
      describeLessonBlocksIssue([
        { type: "text", id: "text-1", markdown: "" },
      ]),
    ).toBeNull();
  });

  it("explains an empty image", () => {
    expect(
      describeLessonBlocksIssue([
        {
          type: "image",
          id: newBlockId("image"),
          src: "",
          alt: "",
        },
      ]),
    ).toMatch(/picture and alt text/i);
  });

  it("explains an empty quote", () => {
    expect(
      describeLessonBlocksIssue([
        {
          type: "quote",
          id: newBlockId("quote"),
          text: "",
          source: "",
        },
      ]),
    ).toMatch(/quoted text and a source/i);
  });

  it("explains an empty glossary term", () => {
    expect(
      describeLessonBlocksIssue([
        {
          type: "glossary",
          id: newBlockId("glossary"),
          terms: [{ term: "", definition: "" }],
        },
      ]),
    ).toMatch(/term and a definition/i);
  });

  it("explains a video without YouTube", () => {
    expect(
      describeLessonBlocksIssue([
        {
          type: "video",
          id: newBlockId("video"),
          youtubeUrl: "",
          transcript: "A transcript",
        },
      ]),
    ).toMatch(/YouTube/i);
  });

  it("explains an empty checkpoint", () => {
    expect(
      describeLessonBlocksIssue([
        {
          type: "checkpoint",
          id: newBlockId("checkpoint"),
          prompt: "",
        },
      ]),
    ).toMatch(/checkpoint question/i);
  });
});
