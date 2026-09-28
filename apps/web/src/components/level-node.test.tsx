import type { PathResponse } from "@jose/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LevelNode } from "./level-node";
import { PathView } from "./path-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ message: vi.fn() }),
}));

describe("LevelNode", () => {
  it("marks locked nodes in the accessible name", () => {
    render(
      <LevelNode
        moduleId="rizal"
        node={{
          id: "x",
          title: "Ateneo Municipal",
          kind: "lesson",
          status: "locked",
          icon: "book",
          position: "center",
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Ateneo Municipal \(locked\)/i }),
    ).toBeTruthy();
  });

  it("does not mark current nodes as locked", () => {
    render(
      <LevelNode
        moduleId="rizal"
        node={{
          id: "y",
          title: "Ateneo Municipal",
          kind: "lesson",
          status: "current",
          icon: "book",
          position: "left",
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Ateneo Municipal" }),
    ).toBeTruthy();
  });

  it("keeps the mobile title clamp instead of a fixed 10.5rem cap", () => {
    render(
      <LevelNode
        moduleId="rizal"
        node={{
          id: "y",
          title: "University of Santo Tomas",
          kind: "lesson",
          status: "current",
          icon: "book",
          position: "left",
        }}
      />,
    );
    const label = screen
      .getByRole("button", { name: "University of Santo Tomas" })
      .querySelector(".path-node-label");
    expect(label?.textContent).toBe("University of Santo Tomas");
    expect(label?.className ?? "").not.toContain("max-w-[10.5rem]");
  });
});

const pathFixture: PathResponse = {
  module: {
    id: "rizal",
    title: "Work and Life of Rizal",
    subtitle: "From Calamba to Bagumbayan",
    coverColor: "#A855F7",
    featured: true,
  },
  learner: {
    id: "demo-student",
    displayName: "Demo",
    streak: 1,
    hearts: 5,
    xp: 10,
  },
  sections: [
    {
      id: "education",
      title: "Education",
      subtitle: "Biñan to Madrid",
      themeColor: "#22C55E",
      objectives: [],
      instructorReviewStatus: "unreviewed",
      nodes: [
        {
          id: "edu-binan",
          title: "School in Biñan",
          kind: "lesson",
          status: "completed",
          icon: "check",
          position: "center",
        },
        {
          id: "edu-ateneo",
          title: "Ateneo Municipal",
          kind: "lesson",
          status: "current",
          icon: "book",
          position: "left",
        },
        {
          id: "edu-ust",
          title: "University of Santo Tomas",
          kind: "lesson",
          status: "locked",
          icon: "book",
          position: "right",
        },
      ],
    },
  ],
};

describe("PathView scroll container", () => {
  const observers: Array<{ root: Element | null }> = [];

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    sessionStorage.clear();
    observers.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function installShell() {
    const shell = document.createElement("main");
    shell.className = "jose-shell-main";
    let scrollTop = 0;
    Object.defineProperty(shell, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Object.defineProperty(shell, "clientHeight", {
      configurable: true,
      value: 640,
    });
    document.body.appendChild(shell);
    return {
      shell,
      readScrollTop: () => scrollTop,
    };
  }

  function installObserver() {
    class ShellIntersectionObserver {
      readonly root: Element | null;
      constructor(
        _callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.root =
          options?.root instanceof Element ? options.root : null;
        observers.push(this);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", ShellIntersectionObserver);
  }

  it("restores and records scroll on the shell, not the window", () => {
    sessionStorage.setItem("jose.pathScroll.rizal", "320");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const windowEvents: string[] = [];
    const originalAdd = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type, listener, options) => {
        windowEvents.push(String(type));
        originalAdd(type, listener, options);
      },
    );
    installObserver();
    const { shell, readScrollTop } = installShell();

    render(<PathView path={pathFixture} />, { container: shell });

    expect(readScrollTop()).toBe(320);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(windowEvents).not.toContain("scroll");
    expect(observers.length).toBeGreaterThan(0);
    expect(observers.every((observer) => observer.root === shell)).toBe(true);

    window.dispatchEvent(new Event("scroll"));
    expect(sessionStorage.getItem("jose.pathScroll.rizal")).toBe("320");

    shell.scrollTop = 180;
    shell.dispatchEvent(new Event("scroll"));
    expect(sessionStorage.getItem("jose.pathScroll.rizal")).toBe("180");
    expect(screen.getByRole("button", { name: "List view" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Current" }).className).toContain(
      "min-h-11",
    );
    expect(screen.getByRole("button", { name: "Current" }).className).toContain(
      "min-w-11",
    );
    expect(
      screen.getByRole("button", { name: "Adventure map" }).className,
    ).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "List view" }).className).toContain(
      "min-w-11",
    );
  });

  it("centers the current node in the shell when no scroll position is saved", () => {
    installObserver();
    const { shell, readScrollTop } = installShell();
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.id === "node-edu-ateneo") {
        return new DOMRect(40, 800 - shell.scrollTop, 80, 80);
      }
      if (this.classList.contains("jose-shell-main")) {
        return new DOMRect(0, 0, 360, 640);
      }
      return new DOMRect(0, 0, 0, 0);
    };

    try {
      render(<PathView path={pathFixture} />, { container: shell });
      expect(readScrollTop()).toBe(520);
      expect(sessionStorage.getItem("jose.pathScroll.rizal")).toBeNull();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
