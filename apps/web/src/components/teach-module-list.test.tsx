import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeachModule } from "@jose/shared";
import { TeachModuleList } from "./teach-module-list";

const mocks = vi.hoisted(() => ({
  deleteTeachModule: vi.fn(),
  duplicateTeachModule: vi.fn(),
  fetchTeachModules: vi.fn(),
}));

vi.mock("@/lib/path-api", () => mocks);

function moduleStub(over: Partial<TeachModule> = {}): TeachModule {
  return {
    id: "mod-live",
    title: "Live module",
    subtitle: "Draft",
    coverColor: "#A855F7",
    featured: false,
    published: false,
    sortOrder: 0,
    sectionCount: 1,
    levelCount: 2,
    ownerUserId: "u1",
    updatedAt: 1,
    revision: 1,
    objectives: null,
    authorReviewedAt: null,
    publishedRevisionId: null,
    archivedAt: null,
    trashedAt: null,
    ...over,
  };
}

describe("TeachModuleList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not list archived modules", () => {
    render(
      <TeachModuleList
        initial={[
          moduleStub(),
          moduleStub({
            id: "mod-gone",
            title: "Archived module",
            archivedAt: 99,
            trashedAt: 99,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Live module")).toBeInTheDocument();
    expect(screen.queryByText("Archived module")).not.toBeInTheDocument();
  });

  it("deletes a module after confirm and reloads the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.deleteTeachModule.mockResolvedValue(undefined);
    mocks.fetchTeachModules.mockResolvedValue([]);
    render(<TeachModuleList initial={[moduleStub()]} />);
    fireEvent.click(screen.getByText("More"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mocks.deleteTeachModule).toHaveBeenCalledWith("mod-live");
    });
    await waitFor(() => {
      expect(screen.queryByText("Live module")).not.toBeInTheDocument();
    });
  });
});
