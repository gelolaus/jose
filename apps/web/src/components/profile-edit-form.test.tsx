import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileEditForm } from "./profile-edit-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const session = vi.hoisted(() => ({
  value: {
    authenticated: true,
    loading: false,
    learner: { displayName: "Nova", avatarId: "compass" },
    user: { displayName: "Nova", admissionEmail: "nova@student.apc.edu.ph" },
  },
}));

vi.mock("@/lib/use-jose-session", () => ({ useJoseSession: () => session.value }));
vi.mock("@/lib/use-explorer-identity", () => ({
  useExplorerIdentity: () => ({ displayName: "Nova", avatarId: "compass" }),
  notifyExplorerIdentityChanged: () => {},
}));
vi.mock("@/lib/auth-api", () => ({ updateProfile: async () => null }));

describe("ProfileEditForm", () => {
  afterEach(() => cleanup());
  it("shows account name/email read-only with no name input", () => {
    render(<ProfileEditForm />);
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByText("nova@student.apc.edu.ph")).toBeInTheDocument();
    expect(screen.queryByLabelText(/display name/i)).toBeNull();
    expect(screen.getByText(/contact an administrator/i)).toBeInTheDocument();
  });
});
