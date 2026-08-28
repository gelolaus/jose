import { describe, expect, it } from "vitest";
import { allStopsFilled, formatTimelineWhy, gradeTimelineCheck } from "./timeline-grade";

const items = [
  { id: "a", label: "Born in Calamba", year: "June 19, 1861", why: "Calamba is the start." },
  { id: "b", label: "Teodora teaches", year: "1860s", why: "Home was the first classroom." },
  { id: "c", label: "Leaves for Biñan", year: "1870" },
];

describe("gradeTimelineCheck", () => {
  it("is not ready until every stop is filled", () => {
    expect(allStopsFilled(items, { 0: "a" })).toBe(false);
    expect(allStopsFilled(items, { 0: "a", 1: "b", 2: "c" })).toBe(true);
  });

  it("locks matches and lists mismatches", () => {
    const result = gradeTimelineCheck(items, { 0: "a", 1: "c", 2: "b" });
    expect(result.perfect).toBe(false);
    expect(result.correctIds).toEqual(["a"]);
    expect(result.wrongItems.map((item) => item.id)).toEqual(["c", "b"]);
  });

  it("is perfect when every event is on its stop", () => {
    const result = gradeTimelineCheck(items, { 0: "a", 1: "b", 2: "c" });
    expect(result.perfect).toBe(true);
    expect(result.wrongItems).toEqual([]);
  });
});

describe("formatTimelineWhy", () => {
  it("returns null when no bounced event has why text", () => {
    expect(formatTimelineWhy([{ id: "c", label: "Leaves for Biñan", year: "1870" }])).toBeNull();
  });

  it("uses the event label as the title when only one why exists", () => {
    expect(formatTimelineWhy([items[1]!])).toEqual({
      title: "Teodora teaches",
      body: "Home was the first classroom.",
    });
  });

  it("lists every why when several events bounce", () => {
    const why = formatTimelineWhy([items[0]!, items[1]!]);
    expect(why?.title).toBe("Check these again");
    expect(why?.body).toBe(
      "Born in Calamba — Calamba is the start.\n\nTeodora teaches — Home was the first classroom.",
    );
  });
});
