import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthMeResponse, SessionUser } from "@jose/shared";
import { LocalDevPanel } from "./local-dev-panel";

const arlaus: SessionUser = {
  id: "u-arlaus",
  role: "student",
  admissionEmail: "arlaus@student.apc.edu.ph",
  displayName: "arlaus",
  suspended: false,
};

const signedIn: AuthMeResponse = {
  authenticated: true,
  user: arlaus,
  learner: {
    id: "u-arlaus",
    displayName: "arlaus",
    avatarId: "compass",
    streak: 0,
    hearts: 5,
    xp: 0,
  },
  demoMode: false,
};

describe("LocalDevPanel", () => {
  afterEach(() => cleanup());

  it("stays hidden unless the server reports local development access", () => {
    render(
      <LocalDevPanel
        enabled={false}
        me={signedIn}
        onEnter={vi.fn()}
        onSwitchRole={vi.fn()}
      />,
    );
    expect(screen.queryByText(/local testing/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /enter as arlaus/i })).toBeNull();
  });

  it("shows the local test account and current role", () => {
    render(
      <LocalDevPanel
        enabled
        me={signedIn}
        onEnter={vi.fn()}
        onSwitchRole={vi.fn()}
      />,
    );
    expect(screen.getByText(/local testing/i)).toBeInTheDocument();
    expect(screen.getByText(/local test account/i)).toBeInTheDocument();
    expect(screen.getByText(/signed in as arlaus/i)).toBeInTheDocument();
    expect(screen.getByText(/view as student/i)).toBeInTheDocument();
    expect(screen.getByText(/view as teacher/i)).toBeInTheDocument();
    expect(screen.getByText(/view as admin/i)).toBeInTheDocument();
    expect(screen.getByText(/this switch exists only on localhost/i)).toBeInTheDocument();
  });

  it("asks the server to switch roles instead of flipping local state only", async () => {
    const onSwitchRole = vi.fn(async () => signedIn);
    render(
      <LocalDevPanel
        enabled
        me={signedIn}
        onEnter={vi.fn()}
        onSwitchRole={onSwitchRole}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /view as admin/i }));
    await waitFor(() => expect(onSwitchRole).toHaveBeenCalledWith("admin"));
  });
});
