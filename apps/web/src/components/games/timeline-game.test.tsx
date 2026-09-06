import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGameContent, type TimelineGame as TimelineContent } from "@jose/shared";
import { TimelineGame } from "./timeline-game";

const parsedTimeline = parseGameContent({
  type: "timeline",
  items: [
    { id: "a", label: "Born in Calamba", year: "June 19, 1861", why: "Calamba is the start." },
    { id: "b", label: "Teodora teaches", year: "1860s", why: "Home was the first classroom." },
    { id: "c", label: "Leaves for Biñan", year: "1870" },
  ],
});
if (parsedTimeline.type !== "timeline") throw new Error("expected timeline");
const game: TimelineContent = parsedTimeline;

const gameWithCausalLink: TimelineContent = {
  ...game,
  causalLink: {
    prompt: "What made Rizal's move to Biñan possible?",
    choices: [
      { id: "a", text: "His early lessons prepared him" },
      { id: "b", text: "It happened before he was born" },
    ],
    correctChoiceId: "a",
    explanation: "His early lessons built the foundation for later schooling.",
  },
};

function play() {
  const onMiss = vi.fn(async () => "ok" as const);
  const onFinish = vi.fn();
  render(
    <TimelineGame game={game} disabled={false} onMiss={onMiss} onFinish={onFinish} />,
  );
  return { onMiss, onFinish };
}

function tapEvent(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function tapStop(n: number) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Stop ${n}`) }));
}

describe("TimelineGame play", () => {
  afterEach(() => cleanup());

  it("keeps Check disabled until every stop is filled", () => {
    play();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    tapEvent("Born in Calamba");
    tapStop(1);
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  it("returns only the wrong events and spends one miss", async () => {
    const { onMiss, onFinish } = play();
    tapEvent("Born in Calamba");
    tapStop(1);
    tapEvent("Teodora teaches");
    tapStop(3);
    tapEvent("Leaves for Biñan");
    tapStop(2);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Teodora teaches" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leaves for Biñan" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Born in Calamba" })).toBeNull();
  });

  it("finishes with one miss after the leftover is fixed", async () => {
    const { onFinish } = play();
    tapEvent("Born in Calamba");
    tapStop(1);
    tapEvent("Teodora teaches");
    tapStop(3);
    tapEvent("Leaves for Biñan");
    tapStop(2);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    tapEvent("Leaves for Biñan");
    tapStop(3);
    tapEvent("Teodora teaches");
    tapStop(2);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(onFinish).toHaveBeenCalledWith(2, 3, 1, {
      type: "timeline",
      order: ["a", "b", "c"],
    });
  });

  it("asks its causal question before finishing a perfect timeline", () => {
    const onMiss = vi.fn(async () => "ok" as const);
    const onFinish = vi.fn();
    render(
      <TimelineGame
        game={gameWithCausalLink}
        disabled={false}
        onMiss={onMiss}
        onFinish={onFinish}
      />,
    );

    for (const [event, stop] of [
      ["Born in Calamba", 1],
      ["Teodora teaches", 2],
      ["Leaves for Biñan", 3],
    ] as const) {
      tapEvent(event);
      tapStop(stop);
    }
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("What made Rizal's move to Biñan possible?")).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("keeps an event selected after pointerdown plus click", () => {
    play();
    const chip = screen.getByRole("button", { name: "Born in Calamba" });
    fireEvent.pointerDown(chip, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 8,
      clientY: 8,
    });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 8, clientY: 8 });
    fireEvent.click(chip);
    tapStop(1);
    expect(screen.queryByRole("button", { name: "Born in Calamba" })).toBeNull();
  });
});
