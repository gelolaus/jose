import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { StatusHud } from "./status-hud";

describe("StatusHud", () => {
  afterEach(cleanup);

  it("renders live values with bundled panel and glyph images", () => {
    const { container } = render(<StatusHud xp={120} streak={3} hearts={5} />);

    expect(screen.getByRole("status", { name: "120 experience points" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "3 day streak" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "5 lives" })).toBeInTheDocument();

    const panels = [...container.querySelectorAll<HTMLImageElement>(".jose-status-hud__panel")];
    expect(panels.map((panel) => panel.getAttribute("src"))).toEqual([
      "/assets/ui/hud/wood-panel-xp.png",
      "/assets/ui/hud/wood-panel-fire.png",
      "/assets/ui/hud/wood-panel-heart.png",
    ]);

    const xpGlyphs = [...container.querySelectorAll<HTMLImageElement>(".jose-status-hud__item--xp .jose-status-hud__glyph")];
    expect(xpGlyphs.map((glyph) => glyph.getAttribute("src"))).toEqual([
      "/assets/ui/hud/glyphs/1.svg",
      "/assets/ui/hud/glyphs/2.svg",
      "/assets/ui/hud/glyphs/0.svg",
      "/assets/ui/hud/glyphs/x.svg",
      "/assets/ui/hud/glyphs/p.svg",
    ]);
  });
});
