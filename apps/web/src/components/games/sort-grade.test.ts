import { describe, expect, it } from "vitest";
import { allChipsPlaced, formatSortWhy, gradeSortCheck } from "./sort-grade";

const items = [
  { id: "a", label: "Ibarra", bucketId: "noli", why: "Noli follows Ibarra." },
  { id: "b", label: "Simoun", bucketId: "fili", why: "Sequel." },
  { id: "c", label: "1887", bucketId: "noli" },
];

describe("gradeSortCheck", () => {
  it("is not ready until every chip is placed", () => {
    expect(allChipsPlaced(items, { a: "noli" })).toBe(false);
    expect(allChipsPlaced(items, { a: "noli", b: "fili", c: "fili" })).toBe(true);
  });

  it("locks matches and lists mismatches", () => {
    const result = gradeSortCheck(items, { a: "noli", b: "noli", c: "noli" });
    expect(result.perfect).toBe(false);
    expect(result.correctIds).toEqual(["a", "c"]);
    expect(result.wrongItems.map((item) => item.id)).toEqual(["b"]);
  });

  it("is perfect when every chip is in the right chest", () => {
    const result = gradeSortCheck(items, { a: "noli", b: "fili", c: "noli" });
    expect(result.perfect).toBe(true);
    expect(result.wrongItems).toEqual([]);
  });
});

describe("formatSortWhy", () => {
  it("returns null when no bounced chip has why text", () => {
    expect(formatSortWhy([{ id: "c", label: "1887", bucketId: "noli" }])).toBeNull();
  });

  it("uses the chip label as the title when only one why exists", () => {
    expect(formatSortWhy([items[1]!])).toEqual({
      title: "Simoun",
      body: "Sequel.",
    });
  });

  it("lists every why when several chips bounce", () => {
    const why = formatSortWhy([items[0]!, items[1]!]);
    expect(why?.title).toBe("Check these again");
    expect(why?.body).toBe("Ibarra — Noli follows Ibarra.\n\nSimoun — Sequel.");
  });
});
