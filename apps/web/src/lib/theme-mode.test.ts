import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTheme, writeTheme } from "./theme-mode";

describe("theme mode", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it("defaults to light and persists the selected theme", () => {
    expect(readTheme()).toBe("light");

    writeTheme("dark");

    expect(localStorage.setItem).toHaveBeenCalledWith("jose.theme", "dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
