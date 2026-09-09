import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeachModuleDetail } from "@jose/shared";
import { TeachModuleWorkspace } from "./teach-module-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }) }));
vi.mock("@/lib/path-api", () => ({
  deleteTeachSection: async () => ({ ok: true }),
  duplicateTeachModule: async () => ({ ok: false, error: "no" }),
  duplicateTeachSection: async () => ({ ok: true, data: {} }),
  extractPublishReadiness: () => [],
  fetchPublishReadiness: async () => [],
  fetchTeachLevel: async () => null,
  patchTeachModule: async (x: unknown) => x,
  patchTeachSection: async (x: unknown) => x,
  publishTeachModule: async () => ({ ok: false, error: "no" }),
  unpublishTeachModule: async () => ({ ok: false, error: "no" }),
  fetchTeachModule: async () => null,
}));

const mod = {
  id: "mod-1",
  title: "Propaganda",
  subtitle: "sub",
  coverColor: "#22C55E",
  sortOrder: 0,
  published: false,
  featured: false,
  ownerUserId: "u-teacher",
  createdAt: 0,
  updatedAt: 0,
  revision: 1,
  objectives: [],
  sections: [
    { id: "sec-1", title: "Origins", subtitle: "", themeColor: "#38BDF8", sortOrder: 0, levels: [{ id: "lvl-1", title: "Why reform mattered", kind: "lesson" }] },
  ],
} as unknown as TeachModuleDetail;

describe("TeachModuleWorkspace outline", () => {
  afterEach(() => cleanup());
  it("labels the mobile button Back to outline and announces the selection", () => {
    render(<TeachModuleWorkspace initial={mod} initialLevelId="lvl-1" />);
    const back = screen.getByRole("button", { name: /back to outline/i });
    expect(back).toBeInTheDocument();
    expect(screen.getByText(/editing lesson/i)).toBeInTheDocument();
    fireEvent.click(back);
    expect(screen.queryByRole("button", { name: /back to outline/i })).toBeNull();
  });
});
