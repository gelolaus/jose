import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LevelNode } from "./level-node";

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
});
