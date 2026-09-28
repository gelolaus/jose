import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import type { PracticeItem, PracticeReviewResponse } from "@jose/shared";
import { PracticeHub } from "./practice-hub";

afterEach(cleanup);

function reviewItem(title: string): PracticeItem {
  const id = title.toLowerCase().replaceAll(" ", "-");
  return {
    id,
    levelId: id,
    moduleId: "mod-1",
    moduleTitle: "Noli",
    sectionTitle: "Chapter 1",
    title,
    kind: "game",
    gameType: "quiz",
    reasonKind: "recent_miss",
    reason: "You missed this recently on the path",
    href: `/practice/review/${id}`,
    dueAt: null,
  };
}

function review(items: PracticeItem[], emptyMessage = "Nothing to review yet."): PracticeReviewResponse {
  return {
    items,
    rules: ["Recent mistakes on path games are queued first."],
    emptyMessage,
  };
}

describe("PracticeHub review inbox", () => {
  it("keeps the server empty message", () => {
    render(
      <PracticeHub
        review={review([], "Finish a path game and it will show up here.")}
      />,
    );

    expect(screen.getByText("Finish a path game and it will show up here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See all" })).not.toBeInTheDocument();
  });

  it("shows three cards and reveals the fourth after See all", () => {
    const items = [
      reviewItem("First miss"),
      reviewItem("Second miss"),
      reviewItem("Third miss"),
      reviewItem("Fourth miss"),
    ];

    render(<PracticeHub review={review(items)} />);

    expect(screen.getByRole("link", { name: /First miss/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Second miss/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Third miss/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Fourth miss/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "See all" }));

    expect(screen.getByRole("link", { name: /Fourth miss/ })).toBeInTheDocument();
  });
});
