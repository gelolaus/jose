import { describe, expect, it } from "vitest";
import {
  blocksToMarkdown,
  markdownToStarterBlocks,
  rejectUnsafeLessonEmbeds,
  validateQuestionImport,
  listModuleTemplateMeta,
  getModuleTemplate,
} from "./index";

describe("lesson blocks", () => {
  it("rejects unsafe image embeds and script markdown", () => {
    expect(
      rejectUnsafeLessonEmbeds([
        {
          type: "image",
          id: "1",
          src: "javascript:alert(1)",
          alt: "bad",
        },
      ]),
    ).toMatch(/unsupported|unsafe/i);

    expect(
      rejectUnsafeLessonEmbeds([
        {
          type: "text",
          id: "2",
          markdown: '<script>alert(1)</script>',
        },
      ]),
    ).toMatch(/cannot include raw embeds/i);
  });

  it("round-trips starter markdown into blocks and back", () => {
    const blocks = markdownToStarterBlocks("## Hello\n\nWorld");
    expect(blocks[0]?.type).toBe("text");
    expect(blocksToMarkdown(blocks)).toContain("Hello");
  });
});

describe("question import", () => {
  it("reports precise row errors before commit for ten questions", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      prompt: `Q${i + 1}`,
      choiceA: "A",
      choiceB: "B",
      correct: i === 3 ? "Z" : "A",
      why: "because",
    }));
    const result = validateQuestionImport({
      mode: "all-or-nothing",
      format: "json",
      rows,
      commit: false,
    });
    expect(result.totalRows).toBe(10);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors[0]?.row).toBe(4);
    expect(result.errors[0]?.message.length).toBeGreaterThan(0);
    expect(result.errors[0]?.field === "correct" || /correct|Invalid/i.test(result.errors[0]!.message)).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.questions).toHaveLength(0);
  });

  it("allows partial import of valid rows", () => {
    const result = validateQuestionImport({
      mode: "partial",
      format: "csv",
      raw: [
        "prompt,choiceA,choiceB,correct",
        "One,A,B,A",
        "Two,A,B,Z",
        "Three,A,B,B",
      ].join("\n"),
      commit: true,
    });
    expect(result.validCount).toBe(2);
    expect(result.errorCount).toBe(1);
    expect(result.questions).toHaveLength(2);
  });
});

describe("templates", () => {
  it("ships the four curated authoring templates", () => {
    const meta = listModuleTemplateMeta();
    expect(meta.map((item) => item.id).sort()).toEqual(
      [
        "chapter-checkpoint",
        "lesson-retrieval",
        "source-investigation",
        "timeline",
      ].sort(),
    );
    const lesson = getModuleTemplate("lesson-retrieval");
    expect(lesson.levels.some((level) => level.kind === "lesson")).toBe(true);
    expect(lesson.levels.some((level) => level.kind === "game")).toBe(true);
  });
});
