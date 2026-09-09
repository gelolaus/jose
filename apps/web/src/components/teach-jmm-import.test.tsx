import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeachJmmImport } from "./teach-jmm-import";

describe("teach jmm import", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("shows validation errors without committing", async () => {
    const onCommit = vi.fn();
    render(
      <TeachJmmImport
        previewAction={async () => ({
          ok: false,
          errors: [{ message: "Unknown tag", line: 3, column: 1 }],
        })}
        commitAction={onCommit}
      />,
    );
    fireEvent.change(screen.getByLabelText(/paste jmm/i), {
      target: { value: "<<<Fancy>>>" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));
    await waitFor(() => expect(screen.getByText(/unknown tag/i)).toBeInTheDocument());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("links to the served authoring guide asset", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    render(<TeachJmmImport />);
    const link = screen.getByRole("link", { name: /authoring guide/i });
    expect(link.getAttribute("href")).toBe("/docs/authoring/jose-module-markup-v1.md");
    // Static public asset must exist and cover every active game type.
    const p = join(process.cwd(), "public", "docs", "authoring", "jose-module-markup-v1.md");
    expect(existsSync(p)).toBe(true);
    const doc = readFileSync(p, "utf8");
    for (const t of ['type="quiz"', 'type="memory"', 'type="timeline"', 'type="blank"', 'type="sort"']) {
      expect(doc).toContain(t);
    }
  });

  it("shows read-only outline and confirms create-draft", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const commitAction = vi.fn(async () => ({
      moduleId: "m1",
      title: "T",
      sectionCount: 1,
      levelCount: 1,
      sourceHash: "h",
      jmmVersion: "1" as const,
    }));
    render(
      <TeachJmmImport
        previewAction={async () => ({
          ok: true,
          errors: [],
          preview: {
            version: "1",
            title: "T",
            subtitle: "S",
            coverColor: "#22C55E",
            objectives: [],
            sections: [
              {
                title: "Sec",
                subtitle: "Sub",
                themeColor: "#38BDF8",
                levels: [{ kind: "lesson", title: "L1" }],
              },
            ],
          },
          stats: { sectionCount: 1, levelCount: 1, imageCount: 0 },
        })}
        commitAction={commitAction}
      />,
    );
    fireEvent.change(screen.getByLabelText(/paste jmm/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));
    await waitFor(() => expect(screen.getByText("Sec")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));
    await waitFor(() => expect(commitAction).toHaveBeenCalled());
  });
});
