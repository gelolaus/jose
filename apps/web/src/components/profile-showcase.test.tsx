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
  it("never renders Teacher area for teachers; admins keep Manage teachers", () => {
    (session.value as { canTeach: boolean; canAdmin: boolean }).canTeach = true;
    (session.value as { canAdmin: boolean }).canAdmin = false;
    const { unmount } = render(<ProfileShowcase stats={stats} />);
    expect(screen.queryByRole("link", { name: /teacher area/i })).toBeNull();
    unmount();
    (session.value as { canAdmin: boolean }).canAdmin = true;
    render(<ProfileShowcase stats={stats} />);
    expect(screen.queryByRole("link", { name: /teacher area/i })).toBeNull();
    expect(screen.getByRole("link", { name: /manage teachers/i })).toBeInTheDocument();
  });
});
