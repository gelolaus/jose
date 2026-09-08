import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthMeResponse } from "@jose/shared";
import { TeachShell } from "./teach-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/teach",
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

describe("TeachShell navigation", () => {
  afterEach(() => {
    cleanup();
    session.value.canTeach = false;
    session.value.canAdmin = false;
    session.value.authenticated = false;
    session.value.user = null;
  });

  it("blocks students", () => {
    signedIn("student");
    render(
      <TeachShell>
        <p>Secret</p>
      </TeachShell>,
    );
    expect(screen.getByText(/teachers only/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^modules$/i })).toBeNull();
  });

  it("shows teacher tabs instead of student chrome", () => {
    signedIn("teacher");
    render(
      <TeachShell>
        <p>Studio</p>
      </TeachShell>,
    );
    expect(screen.getAllByRole("link", { name: /^modules$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^classes$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^learn$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^profile$/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^practice$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /teacher area/i })).toBeNull();
  });
});
