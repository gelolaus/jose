import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthMeResponse } from "@jose/shared";
import { AppShell } from "./learning-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
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
  session.value = {
    ...session.value,
    me: {
      authenticated: true,
      user,
      learner: {
        id: "u1",
        displayName: "arlaus",
        avatarId: "compass",
        streak: 0,
        hearts: 5,
        xp: 0,
      },
      demoMode: false,
    },
    user,
    authenticated: true,
    canTeach: role === "teacher" || role === "admin",
    canAdmin: role === "admin",
    localDevAccess: true,
  };
}

describe("AppShell teacher navigation", () => {
  afterEach(() => {
    cleanup();
    session.value.canTeach = false;
    session.value.canAdmin = false;
    session.value.localDevAccess = false;
    session.value.authenticated = false;
    session.value.user = null;
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
    expect(screen.getAllByRole("link", { name: /teacher area/i }).length).toBeGreaterThan(0);
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
});
