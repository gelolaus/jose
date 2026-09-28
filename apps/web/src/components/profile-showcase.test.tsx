import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfileStatsResponse } from "@jose/shared";
import { ProfileShowcase } from "./profile-showcase";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const session = vi.hoisted(() => ({
  value: {
    authenticated: true,
    loading: false,
    canTeach: false,
    canAdmin: false,
    user: { id: "u1", role: "teacher", admissionEmail: "t@apc.edu.ph", displayName: "Teacher", suspended: false },
  },
}));

vi.mock("@/lib/use-jose-session", () => ({
  useJoseSession: () => session.value,
}));

vi.mock("@/lib/use-explorer-identity", () => ({
  useExplorerIdentity: () => ({ displayName: "Teacher", avatarId: "compass" }),
}));

vi.mock("@/lib/auth-api", () => ({ logoutJose: async () => {}, clearSensitiveClientState: () => {} }));
vi.mock("@/lib/explorer-identity", async (importOriginal) => {
  const mod = await importOriginal() as Record<string, unknown>;
  return { ...mod, clearSensitiveClientState: () => {}, isAvatarId: () => true };
});

const stats = {
  learner: { id: "u1", displayName: "Teacher", avatarId: "compass", streak: 1, hearts: 5, xp: 10 },
  modules: [],
  totals: { completedLevels: 0, totalLevels: 0, chestsOpened: 0 },
  achievements: [],
  rules: { xp: "xp", streak: "streak", hearts: "hearts" },
} as unknown as ProfileStatsResponse;

describe("ProfileShowcase", () => {
  afterEach(() => cleanup());
  it("shows live stats, avatar controls, and the account panel in the character sheet", () => {
    render(<ProfileShowcase stats={stats} />);
    const editProfile = screen.getByRole("link", { name: "Edit Profile" });
    const hud = screen.getByLabelText("Learner status");
    const account = screen.getByRole("heading", { name: "Account & Help" });

    expect(hud).toHaveClass("jose-status-hud--profile");
    expect(screen.getByRole("link", { name: "Customize Avatar" })).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByRole("status", { name: "10 experience points" })).toBeInTheDocument();
    expect(screen.getByText("Current streak: 1 day")).toBeInTheDocument();
    expect(screen.getByText("No completed books yet")).toBeInTheDocument();
    expect(screen.getByText("Finish every level in a module to add its badge.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Compass avatar" })).toBeInTheDocument();
    expect(document.querySelector('img[src*="warrior-avatar"]')).toBeNull();
    expect(hud.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(account.compareDocumentPosition(editProfile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shelves earned badges even when live progress no longer looks complete", () => {
    const earnedAt = Date.parse("2026-09-06T02:00:00.000Z");
    const earnedLabel = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(earnedAt));
    render(<ProfileShowcase stats={{
      ...stats,
      modules: [
        { moduleId: "partial", title: "In progress", featured: true, completedCount: 2, totalCount: 3, coverColor: "#44a" },
        { moduleId: "finished", title: "Draft title", featured: false, completedCount: 1, totalCount: 4, coverColor: "#a44" },
      ],
      badges: [
        {
          moduleId: "finished",
          title: "Finished story",
          subtitle: "Snapshot",
          coverColor: "#a44",
          levelCount: 3,
          earnedAt,
          publishedRevisionId: "rev-1",
          stillPublished: true,
        },
        {
          moduleId: "retired",
          title: "Old tale",
          subtitle: "Gone",
          coverColor: "#444444",
          levelCount: 2,
          earnedAt: earnedAt - 1000,
          publishedRevisionId: "rev-old",
          stillPublished: false,
        },
      ],
      achievements: [
        { id: "on-the-path", title: "On the path", description: "Started", unlocked: true, earnedAt },
        { id: "first-treasure", title: "First treasure", description: "Chest", unlocked: false, earnedAt: null },
        { id: "first-chapter-clear", title: "Chapter cleared", description: "Chapter", unlocked: false, earnedAt: null },
        { id: "course-complete", title: "Course complete", description: "All", unlocked: false, earnedAt: null },
      ],
    }} />);

    const book = screen.getByRole("link", { name: new RegExp(`Finished story, module badge, earned ${earnedLabel}`) });
    expect(book).toHaveAttribute("href", "/learn/finished");
    expect(book.querySelector("img")).toHaveAttribute("src", "/assets/ui/books/01-rizal-law.png");
    expect(book).toHaveTextContent("Finished story");
    expect(book).toHaveTextContent(earnedLabel);
    expect(screen.queryByRole("link", { name: /Old tale/ })).toBeNull();
    expect(screen.getByLabelText("Old tale, retired module")).toHaveTextContent("Retired module");
    expect(screen.getByText("In progress: 2/3")).toBeInTheDocument();
    expect(screen.queryByText("Draft title: 1/4")).toBeNull();
    expect(screen.queryByText("No completed books yet")).toBeNull();
    expect(screen.getByText("Badge earned: Finished story")).toBeInTheDocument();
    expect(screen.getByText(`On the path · ${earnedLabel}`)).toBeInTheDocument();
    expect(screen.getByText("Course complete · Locked")).toBeInTheDocument();
    expect(screen.getByText("First treasure · Locked").closest("li")).toHaveStyle({ opacity: "0.45" });
  });

  it("puts Settings and Teacher area in the account panel for teachers", () => {
    (session.value as { canTeach: boolean; canAdmin: boolean }).canTeach = true;
    (session.value as { canAdmin: boolean }).canAdmin = false;
    const { unmount } = render(<ProfileShowcase stats={stats} />);
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/profile/preferences");
    expect(screen.getByRole("link", { name: /teacher area/i })).toHaveAttribute("href", "/teach");
    expect(screen.queryByRole("link", { name: /manage teachers/i })).toBeNull();
    unmount();
    (session.value as { canAdmin: boolean }).canAdmin = true;
    render(<ProfileShowcase stats={stats} />);
    expect(screen.getByRole("link", { name: /teacher area/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage teachers/i })).toBeInTheDocument();
  });
});
