import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthMeResponse } from "@jose/shared";
import { AppShell } from "./learning-shell";

const pathnameState = vi.hoisted(() => ({ value: "/learn" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

const session = vi.hoisted(() => ({
  value: {
    me: {
      authenticated: false,
      user: null,
      learner: null,
      demoMode: false,
    } as AuthMeResponse,
    loading: false,
    user: null as AuthMeResponse["user"],
    learner: null as AuthMeResponse["learner"],
    authenticated: false,
    demoMode: false,
    canTeach: false,
    canAdmin: false,
    localDevAccess: false,
    refresh: async () => {},
  },
}));

vi.mock("@/lib/use-jose-session", () => ({
  useJoseSession: () => session.value,
  JoseSessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function signedIn(role: "student" | "teacher" | "admin") {
  const user = {
    id: "u1",
    role,
    admissionEmail: "arlaus@student.apc.edu.ph",
    displayName: "arlaus",
    suspended: false,
  };
  const learner = {
    id: "u1",
    displayName: "arlaus",
    avatarId: "compass" as const,
    streak: 0,
    hearts: 5,
    xp: 0,
  };
  session.value = {
    ...session.value,
    me: {
      authenticated: true,
      user,
      learner,
      demoMode: false,
    },
    user,
    learner,
    authenticated: true,
    canTeach: role === "teacher" || role === "admin",
    canAdmin: role === "admin",
    localDevAccess: true,
  };
}

describe("AppShell navigation and HUD", () => {
  afterEach(() => {
    cleanup();
    pathnameState.value = "/learn";
    session.value.canTeach = false;
    session.value.canAdmin = false;
    session.value.localDevAccess = false;
    session.value.authenticated = false;
    session.value.user = null;
    session.value.learner = null;
  });

  it("keeps student navigation for a student and hides teacher tools", () => {
    signedIn("student");
    render(
      <AppShell>
        <p>Learn page</p>
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: /learn/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /practice/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /teacher area/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^teach$/i })).toBeNull();
  });

  it("shows teacher navigation for a teacher while keeping student pages", () => {
    signedIn("teacher");
    render(
      <AppShell>
        <p>Learn page</p>
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: /learn/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /practice/i }).length).toBeGreaterThan(0);
    const teacherLink = screen.getByRole("link", { name: "Teacher area" });
    expect(teacherLink).toHaveAttribute("href", "/teach");
    expect(teacherLink.querySelector("img")).toBeNull();
    const bottomNav = document.querySelector(".jose-bottom-nav");
    expect(bottomNav).not.toBeNull();
    expect(bottomNav).not.toHaveTextContent("Teacher area");
    expect(within(bottomNav as HTMLElement).getAllByRole("link", { name: /learn|practice|bookmarks|profile/i })).toHaveLength(4);
  });

  it("shows teacher navigation for an admin while keeping student pages", () => {
    signedIn("admin");
    render(
      <AppShell>
        <p>Learn page</p>
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: /learn/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /practice/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /teacher area/i }).length).toBeGreaterThan(0);
  });

  it.each(["/learn", "/learn/rizal"])(
    "shows the HUD on %s",
    (path) => {
      pathnameState.value = path;
      signedIn("student");
      render(<AppShell>Page content</AppShell>);
      expect(screen.getByLabelText("Learner status")).toBeInTheDocument();
    },
  );

  it.each(["/practice", "/bookmarks", "/profile", "/profile/edit", "/profile/preferences"])(
    "hides the HUD on %s",
    (path) => {
      pathnameState.value = path;
      signedIn("student");
      render(<AppShell>Page content</AppShell>);
      expect(screen.queryByLabelText("Learner status")).not.toBeInTheDocument();
    },
  );

  it("renders a visible text label under each bottom-nav image", () => {
    pathnameState.value = "/practice";
    signedIn("student");
    render(<AppShell>Page content</AppShell>);
    const bottomNav = document.querySelector(".jose-bottom-nav");
    expect(bottomNav).not.toBeNull();
    const labels = within(bottomNav as HTMLElement).getAllByText(/^(Learn|Practice|Bookmarks|Profile)$/);
    expect(labels.map((label) => label.textContent)).toEqual([
      "Learn",
      "Practice",
      "Bookmarks",
      "Profile",
    ]);
    for (const label of labels) {
      expect(label).toHaveClass("shell-nav-label");
      expect(label.closest("a")?.querySelector("img")).not.toBeNull();
    }
    expect(within(bottomNav as HTMLElement).queryByRole("link", { name: "Settings" })).toBeNull();
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(settings).toHaveAttribute("href", "/profile/preferences");
    expect(settings).toHaveClass("sidebar-settings");
    expect(settings.querySelector("img")).toBeNull();
  });

  it("hides the bottom nav on a level route and keeps the sidebar", () => {
    pathnameState.value = "/learn/rizal/the-trial";
    signedIn("student");
    render(<AppShell>Play</AppShell>);
    expect(document.querySelector(".jose-bottom-nav")).toBeNull();
    expect(document.querySelector(".shell-mobile-dock")).toBeNull();
    expect(document.querySelector("[data-bottom-nav='hidden']")).not.toBeNull();
    expect(document.querySelector(".jose-sidebar")).not.toBeNull();
    expect(screen.getAllByRole("link", { name: /learn/i }).length).toBeGreaterThan(0);
  });

  it.each([
    "/learn",
    "/learn/rizal",
    "/learn/challenges",
    "/practice",
    "/bookmarks",
    "/profile",
    "/profile/preferences",
  ])("shows the bottom nav on %s", (path) => {
    pathnameState.value = path;
    signedIn("student");
    render(<AppShell>Page content</AppShell>);
    expect(document.querySelector(".jose-bottom-nav")).not.toBeNull();
    expect(document.querySelector("[data-bottom-nav='shown']")).not.toBeNull();
  });

  it.each(["/practice", "/bookmarks", "/profile", "/profile/edit"])(
    "shows a compact streak chip on %s",
    (path) => {
      pathnameState.value = path;
      signedIn("student");
      if (session.value.learner) session.value.learner.streak = 6;
      render(<AppShell>Page content</AppShell>);
      expect(screen.getByRole("status", { name: "6 day streak" })).toBeInTheDocument();
      expect(screen.queryByLabelText("Learner status")).not.toBeInTheDocument();
    },
  );

  it("omits the streak chip when the learner is missing", () => {
    pathnameState.value = "/practice";
    render(<AppShell>Page content</AppShell>);
    expect(screen.queryByRole("status", { name: /day streak/i })).not.toBeInTheDocument();
  });

  it("does not add a second streak chip on learn routes", () => {
    pathnameState.value = "/learn/rizal";
    signedIn("student");
    if (session.value.learner) session.value.learner.streak = 3;
    render(<AppShell>Page content</AppShell>);
    expect(screen.getByLabelText("Learner status")).toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: /day streak/i })).toHaveLength(1);
    expect(document.querySelector(".shell-streak-chip")).toBeNull();
  });
});
