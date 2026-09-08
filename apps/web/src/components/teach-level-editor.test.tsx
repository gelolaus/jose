import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyLessonEditorial, type TeachLevelDetail } from "@jose/shared";
import { TeachLevelEditor } from "./teach-level-editor";

const mocks = vi.hoisted(() => ({
  putTeachLesson: vi.fn(),
  patchTeachLevel: vi.fn(),
  putTeachGame: vi.fn(),
  fetchTeachModule: vi.fn(),
  fetchTeachLevel: vi.fn(),
  importTeachQuestions: vi.fn(),
  fetchTeachAssets: vi.fn(async () => []),
  createTeachAsset: vi.fn(),
}));

vi.mock("@/lib/path-api", () => mocks);

const level: TeachLevelDetail = {
  id: "lvl-1",
  title: "First lesson",
  kind: "lesson",
  gameType: null,
  sortOrder: 0,
  revision: 3,
  moduleId: "mod-1",
  sectionId: "sec-1",
  lesson: {
    markdown: "Hello",
    youtubeVideoId: null,
    blocks: [{ type: "text", id: "text-1", markdown: "Hello" }],
    editorial: emptyLessonEditorial(),
  },
  game: null,
  chest: null,
};

describe("TeachLevelEditor save", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function renderEditor() {
    return render(
      <TeachLevelEditor
        moduleId="mod-1"
        level={level}
        onLevelChange={async () => {}}
        onModuleChange={() => {}}
        onDraftChange={() => {}}
        onGuardChange={() => {}}
      />,
    );
  }

  it("does not call the lesson API when an empty image is added", () => {
    renderEditor();
    fireEvent.click(screen.getByText(/^Add$/));
    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    expect(mocks.putTeachLesson).not.toHaveBeenCalled();
    expect(mocks.patchTeachLevel).not.toHaveBeenCalled();
  });

  it("refuses Save until the new image is filled in", () => {
    renderEditor();
    fireEvent.click(screen.getByText(/^Add$/));
    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(mocks.putTeachLesson).not.toHaveBeenCalled();
    expect(screen.getByText(/picture and alt text/i)).toBeInTheDocument();
  });

  it("clears the save error after the empty image is removed", () => {
    renderEditor();
    fireEvent.click(screen.getByText(/^Add$/));
    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByText(/picture and alt text/i)).toBeInTheDocument();
    const imageMenu = screen.getByLabelText("image actions").closest("details");
    expect(imageMenu).toBeTruthy();
    fireEvent.click(within(imageMenu as HTMLElement).getByRole("button", { name: "Remove" }));
    expect(screen.queryByText(/picture and alt text/i)).not.toBeInTheDocument();
    expect(mocks.putTeachLesson).not.toHaveBeenCalled();
  });
});
