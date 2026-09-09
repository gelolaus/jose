import { describe, expect, it } from "vitest";
import {
  JMM_MAX_SOURCE_BYTES,
  jmmImportCommitBodySchema,
  jmmSourceByteLength,
  parseJoseModuleMarkup,
} from "./jose-module-markup";

const MINIMAL = `<<<JoseModule version="1">>>
title: The Propaganda Movement
subtitle: Ideas, writings, and reform
coverColor: #22C55E
objectives:
  - Explain why the movement formed.

<<<Section>>>
title: Origins
subtitle: Context before 1882
themeColor: #38BDF8

<<<Lesson>>>
title: Why reform mattered

<<<Text markdown>>>
## A movement across borders

Write ordinary CommonMark here with enough context to pass readiness checks later.
<<<Text/>>>
<<<Lesson/>>>
<<<Section/>>>
<<<JoseModule/>>>`;

describe("jmm parser", () => {
  it("parses the minimal envelope with line-accurate tree", () => {
    const res = parseJoseModuleMarkup(MINIMAL);
    expect(res.ok).toBe(true);
    expect(res.preview?.sections).toHaveLength(1);
    expect(res.preview?.sections[0]?.levels).toHaveLength(1);
  });

  it("rejects LIFO violations with line/column", () => {
    const res = parseJoseModuleMarkup(
      MINIMAL.replace("<<<Lesson/>>>", "<<<Section/>>>"),
    );
    expect(res.ok).toBe(false);
    expect(res.errors[0]?.line).toBeGreaterThan(0);
    expect(res.errors[0]?.column).toBeGreaterThan(0);
  });

  it("rejects unknown tags", () => {
    const res = parseJoseModuleMarkup(
      MINIMAL.replace("<<<Text markdown>>>", "<<<Fancy>>>"),
    );
    expect(res.ok).toBe(false);
    expect(res.errors[0]?.message).toMatch(/unknown tag/i);
  });

  it("rejects unsupported game type and bad JSON", () => {
    const badType = MINIMAL.replace(
      "<<<Lesson/>>>",
      `<<<Lesson/>>>\n<<<Game type="chess">>\ntitle: X\n{"type":"chess"}\n<<<Game/>>>`,
    );
    expect(parseJoseModuleMarkup(badType).ok).toBe(false);
    const badJson = MINIMAL.replace(
      "<<<Lesson/>>>",
      `<<<Lesson/>>>\n<<<Game type="quiz">>\ntitle: Q\n{not json}\n<<<Game/>>>`,
    );
    expect(parseJoseModuleMarkup(badJson).ok).toBe(false);
  });

  it("rejects unsafe markup and missing alt/transcript", () => {
    const unsafe = MINIMAL.replace(
      "Write ordinary CommonMark here with enough context to pass readiness checks later.",
      "<script>alert(1)</script>",
    );
    expect(parseJoseModuleMarkup(unsafe).ok).toBe(false);
    const noAlt = MINIMAL.replace(
      "<<<Text/>>>",
      `<<<Text/>>>\n<<<Image>>>\nsrc: https://example.edu/image.jpg\n<<<Image/>>>`,
    );
    expect(parseJoseModuleMarkup(noAlt).ok).toBe(false);
  });

  it("rejects oversized input", () => {
    const big = `<<<JoseModule version="1">>>\n${"x".repeat(200_001)}`;
    expect(parseJoseModuleMarkup(big).ok).toBe(false);
  });

  it("measures UTF-8 bytes, not JS chars", () => {
    // "é" is 1 char but 2 bytes; emoji is 2 chars (surrogate) but 4 bytes.
    expect(jmmSourceByteLength("é")).toBe(2);
    expect(jmmSourceByteLength("😀")).toBe(4);
    // Char count below limit but byte count above must be rejected.
    const prefix = `<<<JoseModule version="1">>>\ntitle: T\nsubtitle: S\ncoverColor: #22C55E\nobjectives:\n  - O\n\n<<<Section>>>\ntitle: S\nsubtitle: S\nthemeColor: #38BDF8\n\n<<<Lesson>>>\ntitle: L\n\n<<<Text markdown>>>\n`;
    const suffix = `\n<<<Text/>>>\n<<<Lesson/>>>\n<<<Section/>>>\n<<<JoseModule/>>>`;
    const overhead = jmmSourceByteLength(prefix + suffix);
    const remaining = JMM_MAX_SOURCE_BYTES - overhead;
    // Fill with 2-byte chars so char length stays under limit while bytes exceed it.
    const charsNeeded = Math.floor(remaining / 2) + 10;
    const multibyte = prefix + "é".repeat(charsNeeded) + suffix;
    expect(multibyte.length).toBeLessThan(JMM_MAX_SOURCE_BYTES);
    expect(jmmSourceByteLength(multibyte)).toBeGreaterThan(JMM_MAX_SOURCE_BYTES);
    expect(parseJoseModuleMarkup(multibyte).ok).toBe(false);
    expect(jmmImportCommitBodySchema.safeParse({ source: multibyte }).success).toBe(false);
  });

  it("accepts sources above 64 KiB up to the documented maximum", () => {
    const header = `<<<JoseModule version="1">>>\ntitle: Big\nsubtitle: Subtitle for large import\ncoverColor: #22C55E\nobjectives:\n  - O\n`;
    let body = "";
    // 4 sections x 18k text = ~72k total, each block under JMM_MAX_TEXT_CHARS.
    for (let s = 0; s < 4; s++) {
      body += `\n<<<Section>>>\ntitle: Sec ${s}\nsubtitle: Sub ${s}\nthemeColor: #38BDF8\n\n<<<Lesson>>>\ntitle: Lesson ${s}\n\n<<<Text markdown>>>\n${"a".repeat(18_000)}\n<<<Text/>>>\n<<<Lesson/>>>\n<<<Section/>>>`;
    }
    const source = `${header}${body}\n<<<JoseModule/>>>`;
    expect(jmmSourceByteLength(source)).toBeGreaterThan(64 * 1024);
    expect(jmmSourceByteLength(source)).toBeLessThanOrEqual(JMM_MAX_SOURCE_BYTES);
    const parsed = parseJoseModuleMarkup(source);
    expect(parsed.ok).toBe(true);
    expect(jmmImportCommitBodySchema.safeParse({ source }).success).toBe(true);
  });

  it("parses every lesson block tag", () => {
    const full = MINIMAL.replace(
      "<<<Text/>>>",
      `<<<Text/>>>
<<<Image>>>
src: https://example.edu/image.jpg
alt: Students reading a nineteenth-century newspaper
attribution: Library collection, public domain
<<<Image/>>>
<<<Quote>>>
text: Education is the foundation of society.
source: Jose Rizal
citation: Exact source and page or stable URL
<<<Quote/>>>
<<<Glossary>>>
- term: Propaganda Movement
  definition: A reform movement led by Filipino expatriates.
<<<Glossary/>>>
<<<Video>>>
youtubeUrl: https://www.youtube.com/watch?v=abcdefghijk
title: Lecture excerpt
transcript: A full text alternative goes here.
<<<Video/>>>
<<<Checkpoint>>>
prompt: Which condition made overseas publication useful?
answerHint: Think about colonial censorship.
<<<Checkpoint/>>>`,
    );
    const res = parseJoseModuleMarkup(full);
    expect(res.ok).toBe(true);
    const blocks = res.preview?.sections[0]?.levels[0];
    expect(blocks?.kind).toBe("lesson");
    if (blocks?.kind === "lesson") expect(blocks.blocks).toHaveLength(6);
  });

  it("parses a valid quiz game with matching type attr", () => {
    const withGame = MINIMAL.replace(
      "<<<Lesson/>>>",
      `<<<Lesson/>>>
<<<Game type="quiz">>>
title: Check the evidence
{
  "type": "quiz",
  "questions": [
    {
      "id": "q1",
      "prompt": "Which source best supports the claim?",
      "choices": [
        { "id": "a", "text": "A dated letter" },
        { "id": "b", "text": "An unsourced post" }
      ],
      "correctChoiceId": "a",
      "explanation": "The letter has author and date information."
    }
  ]
}
<<<Game/>>>`,
    );
    const res = parseJoseModuleMarkup(withGame);
    expect(res.ok).toBe(true);
    expect(res.preview?.sections[0]?.levels).toHaveLength(2);
  });

  it("rejects game type mismatch and retired types", () => {
    const mismatch = MINIMAL.replace(
      "<<<Lesson/>>>",
      `<<<Lesson/>>>
<<<Game type="memory">>>
title: Mismatch
{ "type": "quiz", "questions": [{ "id": "q1", "prompt": "P", "choices": [{ "id": "a", "text": "A" }, { "id": "b", "text": "B" }], "correctChoiceId": "a" }] }
<<<Game/>>>`,
    );
    expect(parseJoseModuleMarkup(mismatch).ok).toBe(false);
    const retired = MINIMAL.replace(
      "<<<Lesson/>>>",
      `<<<Lesson/>>>
<<<Game type="case-files">>>
title: Retired
{ "type": "case-files", "teacherInstructions": "x", "question": "x", "objective": "x", "sources": [], "conclusions": [], "acceptedEvidenceByConclusion": {}, "reasoningPrompt": "x", "debrief": "x", "rubric": [] }
<<<Game/>>>`,
    );
    const retiredRes = parseJoseModuleMarkup(retired);
    expect(retiredRes.ok).toBe(false);
    expect(retiredRes.errors[0]?.message).toMatch(/retired|unsupported/i);
  });

  it("rejects missing accessibility fields", () => {
    const noTranscript = MINIMAL.replace(
      "<<<Text/>>>",
      `<<<Text/>>>
<<<Video>>>
youtubeUrl: https://www.youtube.com/watch?v=abcdefghijk
title: No transcript
<<<Video/>>>`,
    );
    expect(parseJoseModuleMarkup(noTranscript).ok).toBe(false);
    const noQuoteSource = MINIMAL.replace(
      "<<<Text/>>>",
      `<<<Text/>>>
<<<Quote>>>
text: Some words
<<<Quote/>>>`,
    );
    expect(parseJoseModuleMarkup(noQuoteSource).ok).toBe(false);
    const emptyGlossary = MINIMAL.replace(
      "<<<Text/>>>",
      `<<<Text/>>>
<<<Glossary>>>
<<<Glossary/>>>`,
    );
    expect(parseJoseModuleMarkup(emptyGlossary).ok).toBe(false);
  });

  it("rejects bad structure and duplicate titles", () => {
    expect(parseJoseModuleMarkup("no envelope here").ok).toBe(false);
    const dupSection = `${MINIMAL.replace("<<<JoseModule/>>>", "")}
<<<Section>>>
title: Origins
subtitle: Again
themeColor: #38BDF8

<<<Lesson>>>
title: Another lesson

<<<Text markdown>>>
Enough content here to be valid for the duplicate section check path.
<<<Text/>>>
<<<Lesson/>>>
<<<Section/>>>
<<<JoseModule/>>>`;
    expect(parseJoseModuleMarkup(dupSection).ok).toBe(false);
    const badColor = MINIMAL.replace("#22C55E", "red");
    expect(parseJoseModuleMarkup(badColor).ok).toBe(false);
  });

  it("rejects wrong nesting and unclosed tags", () => {
    const textInSection = MINIMAL.replace(
      "<<<Lesson>>>",
      "<<<Text markdown>>>\nStray\n<<<Text/>>>\n<<<Lesson>>>",
    );
    expect(parseJoseModuleMarkup(textInSection).ok).toBe(false);
    const unclosed = MINIMAL.replace("<<<JoseModule/>>>", "");
    expect(parseJoseModuleMarkup(unclosed).ok).toBe(false);
  });

  it("ships an authoring guide covering every active game type", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const p = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "docs",
      "authoring",
      "jose-module-markup-v1.md",
    );
    expect(fs.existsSync(p)).toBe(true);
    const doc = fs.readFileSync(p, "utf8");
    for (const t of [
      'type="quiz"',
      'type="memory"',
      'type="timeline"',
      'type="blank"',
      'type="sort"',
    ]) {
      expect(doc).toContain(t);
    }
    expect(doc).toMatch(/never invent citations/i);
    expect(doc).toMatch(/alt text/i);
    expect(doc).toMatch(/transcript/i);
    expect(doc).toMatch(/raw HTML/i);
  });
});
