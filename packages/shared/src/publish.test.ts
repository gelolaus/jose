import { describe, expect, it } from "vitest";
import { assessPublishReadiness, csvSafeCell, emptyCaseFilesGame, emptyChestContent, emptyLessonEditorial, toCsv } from "./index";

describe("assessPublishReadiness", () => {
  it("blocks unreviewed defaults and placeholder lessons", () => {
    const result = assessPublishReadiness({
      id: "m1",
      title: "Draft",
      objectives: null,
      authorReviewed: false,
      sections: [
        {
          id: "s1",
          title: "Section",
          levels: [
            {
              id: "l1",
              title: "Lesson",
              kind: "lesson",
              gameType: null,
              sectionId: "s1",
              lesson: {
                markdown: "## Title\n\nWrite the lesson here.",
                youtubeVideoId: null,
                editorial: emptyLessonEditorial(),
              },
            },
            {
              id: "l2",
              title: "Quiz",
              kind: "game",
              gameType: "quiz",
              sectionId: "s1",
              game: {
                type: "quiz",
                questions: [
                  {
                    prompt: "Question",
                    choices: ["Choice A", "Choice B"],
                    correctIndex: 0,
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.some((issue) => issue.code === "module.unreviewed")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "module.objectives")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "lesson.placeholder")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "game.placeholder")).toBe(true);
    expect(result.blockers.every((issue) => issue.path.length > 0)).toBe(true);
  });

  it("rejects invalid sort bucket refs, duplicate ids, and blank ambiguity", () => {
    const result = assessPublishReadiness({
      id: "m1",
      title: "Draft",
      objectives: "Learn sorting and blanks.",
      authorReviewed: true,
      sections: [
        {
          id: "s1",
          title: "Section",
          levels: [
            {
              id: "sort1",
              title: "Sort",
              kind: "game",
              gameType: "sort",
              sectionId: "s1",
              game: {
                type: "sort",
                buckets: [
                  { id: "a", label: "Reform" },
                  { id: "b", label: "Revolution" },
                ],
                items: [
                  { id: "i1", label: "Liga", bucketId: "missing" },
                  { id: "i1", label: "Katipunan", bucketId: "b" },
                ],
              },
            },
            {
              id: "blank1",
              title: "Blank",
              kind: "game",
              gameType: "blank",
              sectionId: "s1",
              game: {
                type: "blank",
                items: [
                  {
                    sentence: "Rizal was born in Calamba.",
                    answer: "Calamba",
                    decoys: ["Calamba", "Manila"],
                  },
                ],
              },
            },
            {
              id: "mismatch",
              title: "Mismatch",
              kind: "game",
              gameType: "quiz",
              sectionId: "s1",
              game: {
                type: "timeline",
                items: [
                  { id: "e1", label: "Birth" },
                  { id: "e1", label: "Death" },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.some((issue) => issue.code === "sort.invalid_bucket")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "game.duplicate_id")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "blank.missing_slot")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "blank.ambiguous")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "game.type_mismatch")).toBe(true);
  });

  it("blocks draft investigation games and chests until sources are approved", () => {
    const result = assessPublishReadiness({
      id: "m1",
      title: "Draft",
      objectives: "Investigate sourced claims.",
      authorReviewed: true,
      sections: [
        {
          id: "s1",
          title: "Section",
          levels: [
            {
              id: "cf1",
              title: "Case Files",
              kind: "game",
              gameType: "case-files",
              sectionId: "s1",
              game: emptyCaseFilesGame(),
            },
            {
              id: "chest1",
              title: "Chest",
              kind: "chest",
              gameType: null,
              sectionId: "s1",
              chest: emptyChestContent(),
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.some((issue) => issue.code === "game.draft")).toBe(true);
    expect(result.blockers.some((issue) => issue.code === "chest.draft")).toBe(true);
  });
});

describe("csvSafeCell", () => {
  it("guards spreadsheet formula injection", () => {
    expect(csvSafeCell("=cmd")).toBe("'=cmd");
    expect(csvSafeCell("+1")).toBe("'+1");
    expect(csvSafeCell("-1")).toBe("'-1");
    expect(csvSafeCell("@x")).toBe("'@x");
    expect(toCsv([["name", "=1+1"], ["ok", "plain"]])).toContain("'=1+1");
  });
});
