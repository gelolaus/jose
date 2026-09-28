import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { StatusHud } from "./status-hud";

const homeMobileCss = readFileSync(path.join(process.cwd(), "src/components/home-mobile.css"), "utf8");

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

  it("keeps XP, streak, and lives readable on one header row at 320px", () => {
    render(<StatusHud xp={120} streak={3} hearts={5} />);

    const xp = screen.getByRole("status", { name: "120 experience points" });
    const streak = screen.getByRole("status", { name: "3 day streak" });
    const lives = screen.getByRole("status", { name: "5 lives" });

    expect(xp).toBeInTheDocument();
    expect(streak).toBeInTheDocument();
    expect(lives).toBeInTheDocument();
    expect(xp.compareDocumentPosition(streak) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(streak.compareDocumentPosition(lives) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(xp.querySelector(".jose-status-hud__plain")).toHaveTextContent("120 XP");
    expect(streak.querySelector(".jose-status-hud__plain")).toBeNull();
    expect(lives.querySelector(".jose-status-hud__plain")).toBeNull();

    const narrow = homeMobileCss.slice(homeMobileCss.indexOf("@media (max-width: 480px)"));
    expect(narrow).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(narrow).toContain("grid-area: 1 / 1");
    expect(narrow).toContain("grid-area: 1 / 2");
    expect(narrow).toContain("grid-area: 1 / 3");
    expect(narrow).toContain(".jose-status-hud__plain");
  });
});
