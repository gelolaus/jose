import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGameContent } from "@jose/shared";
import { SortGame } from "./sort-game";

const game = parseGameContent({
  type: "sort",
  buckets: [
    { id: "noli", label: "Noli Me Tangere" },
    { id: "fili", label: "El Filibusterismo" },
  ],
  items: [
    { id: "a", label: "Ibarra", bucketId: "noli", why: "Noli follows Ibarra." },
    { id: "b", label: "Simoun", bucketId: "fili", why: "Sequel." },
    { id: "c", label: "1887", bucketId: "noli" },
  ],
});
if (game.type !== "sort") throw new Error("expected sort");
const sortGame = game;

function play() {
  const onMiss = vi.fn(async () => "ok" as const);
  const onFinish = vi.fn();
  render(
    <SortGame game={sortGame} disabled={false} onMiss={onMiss} onFinish={onFinish} />,
  );
  return { onMiss, onFinish };
}

function tapChip(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function tapChest(label: string) {
  fireEvent.click(screen.getByRole("button", { name: `${label} chest` }));
}

describe("SortGame play", () => {
  afterEach(() => cleanup());

  it("keeps Check disabled until every chip is in a chest", () => {
    play();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    tapChip("Ibarra");
    tapChest("Noli Me Tangere");
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  it("returns only the wrong chips and spends one miss", async () => {
    const { onMiss, onFinish } = play();
    tapChip("Ibarra");
    tapChest("Noli Me Tangere");
    tapChip("Simoun");
    tapChest("Noli Me Tangere");
    tapChip("1887");
    tapChest("Noli Me Tangere");
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Simoun" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ibarra" })).toBeNull();
  });

  it("finishes with one miss after the leftover is fixed", async () => {
    const { onFinish } = play();
    tapChip("Ibarra");
    tapChest("Noli Me Tangere");
    tapChip("Simoun");
    tapChest("Noli Me Tangere");
    tapChip("1887");
    tapChest("Noli Me Tangere");
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    tapChip("Simoun");
    tapChest("El Filibusterismo");
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(onFinish).toHaveBeenCalledWith(2, 3, 1, {
      type: "sort",
      placements: { a: "noli", b: "fili", c: "noli" },
    });
  });
  it("omits legacy insufficient-evidence cards and categories", () => {
    const legacy = {
      ...sortGame,
      buckets: [...sortGame.buckets, { id: "unsure", label: "Insufficient evidence", role: "insufficient-evidence" as const }],
      items: [...sortGame.items, { id: "rumor", label: "A vague rumor", bucketId: "unsure", scoring: "auto" as const }],
    };
    render(<SortGame game={legacy} onMiss={vi.fn(async () => "ok" as const)} onFinish={vi.fn()} />);
    expect(screen.queryByText(/insufficient evidence/i)).toBeNull();
    expect(screen.queryByText("A vague rumor")).toBeNull();
  });

});
