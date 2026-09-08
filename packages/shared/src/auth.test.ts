import { describe, expect, it } from "vitest";
import {
  APC_ADMISSION_DOMAINS,
  AUTH_DENIAL_MESSAGES,
  AVATAR_IDS,
  LOCAL_DEV_TEST_EMAIL,
  SESSION_COOKIE_NAME,
  adminBootstrapBodySchema,
  authMeResponseSchema,
  authStatusSchema,
  canAccessTeacherStudio,
  grantCollaboratorBodySchema,
  grantRoleBodySchema,
  isLocalDevTestEmail,
  localDevRoleBodySchema,
  profilePatchBodySchema,
  roleFromAdmissionEmail,
  sessionUserSchema,
} from "./auth";

describe("auth contracts", () => {
  it("lists exact APC domains only", () => {
    expect(APC_ADMISSION_DOMAINS).toEqual(["apc.edu.ph", "student.apc.edu.ph"]);
  });

  it("keeps switch-account copy explicit", () => {
    expect(AUTH_DENIAL_MESSAGES.switch_account).toMatch(/APC email/i);
    expect(AUTH_DENIAL_MESSAGES.switch_account).toMatch(/Switch Microsoft account/i);
  });

  it("parses session user payloads", () => {
    const user = sessionUserSchema.parse({
      id: "u1",
      role: "student",
      admissionEmail: "learner@student.apc.edu.ph",
      displayName: "Learner",
      suspended: false,
    });
    expect(user.role).toBe("student");
  });

  it("parses auth status", () => {
    const status = authStatusSchema.parse({
      mode: "mock",
      microsoftConfigured: false,
      mockEnabled: true,
      demoMode: true,
      allowedDomains: [...APC_ADMISSION_DOMAINS],
      webOrigin: "http://localhost:3000",
    });
    expect(status.mockEnabled).toBe(true);
    expect(status.demoMode).toBe(true);
    expect(status.localDevAccess).toBe(false);
  });

  it("carries an explicit local development access flag", () => {
    const status = authStatusSchema.parse({
      mode: "microsoft",
      microsoftConfigured: true,
      mockEnabled: false,
      allowedDomains: [...APC_ADMISSION_DOMAINS],
      webOrigin: "http://localhost:3000",
      localDevAccess: true,
    });
    expect(status.localDevAccess).toBe(true);
  });

  it("rejects a non-boolean local development access flag", () => {
    expect(
      authStatusSchema.safeParse({
        mode: "disabled",
        microsoftConfigured: false,
        mockEnabled: false,
        allowedDomains: [...APC_ADMISSION_DOMAINS],
        webOrigin: null,
        localDevAccess: "yes",
      }).success,
    ).toBe(false);
  });

  it("names the session cookie the API sets", () => {
    expect(SESSION_COOKIE_NAME).toBe("jose_session");
  });
});

describe("roleFromAdmissionEmail", () => {
  it("never promotes anyone from their email domain", () => {
    expect(roleFromAdmissionEmail("dean@apc.edu.ph")).toBe("student");
    expect(roleFromAdmissionEmail("kid@student.apc.edu.ph")).toBe("student");
    expect(roleFromAdmissionEmail("faculty@apc.edu.ph")).not.toBe("teacher");
  });
});

describe("canAccessTeacherStudio", () => {
  it("allows teachers and admins only", () => {
    expect(canAccessTeacherStudio("teacher")).toBe(true);
    expect(canAccessTeacherStudio("admin")).toBe(true);
  });

  it("rejects students and anonymous callers", () => {
    expect(canAccessTeacherStudio("student")).toBe(false);
    expect(canAccessTeacherStudio(null)).toBe(false);
    expect(canAccessTeacherStudio(undefined)).toBe(false);
  });
});

describe("local development test account", () => {
  it("names the exact Arlaus mailbox", () => {
    expect(LOCAL_DEV_TEST_EMAIL).toBe("arlaus@student.apc.edu.ph");
  });

  it("accepts only the normalized Arlaus email", () => {
    expect(isLocalDevTestEmail("arlaus@student.apc.edu.ph")).toBe(true);
    expect(isLocalDevTestEmail("  ARLAUS@Student.APC.edu.ph ")).toBe(true);
    expect(isLocalDevTestEmail("faculty@apc.edu.ph")).toBe(false);
    expect(isLocalDevTestEmail("other@student.apc.edu.ph")).toBe(false);
  });

  it("accepts student, teacher, or admin and refuses unknown roles", () => {
    expect(localDevRoleBodySchema.safeParse({ role: "student" }).success).toBe(true);
    expect(localDevRoleBodySchema.safeParse({ role: "teacher" }).success).toBe(true);
    expect(localDevRoleBodySchema.safeParse({ role: "admin" }).success).toBe(true);
    expect(localDevRoleBodySchema.safeParse({ role: "owner" }).success).toBe(false);
    expect(localDevRoleBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("privileged request bodies", () => {
  it("requires a bootstrap token", () => {
    expect(adminBootstrapBodySchema.safeParse({}).success).toBe(false);
    expect(adminBootstrapBodySchema.safeParse({ token: "t" }).success).toBe(true);
  });

  it("refuses to carry an admin grant", () => {
    expect(
      grantRoleBodySchema.safeParse({ email: "a@apc.edu.ph", role: "admin" }).success,
    ).toBe(false);
    expect(
      grantRoleBodySchema.safeParse({ email: "a@apc.edu.ph", role: "teacher" }).success,
    ).toBe(true);
  });

  it("takes a collaborator email", () => {
    expect(grantCollaboratorBodySchema.safeParse({ email: "not-mail" }).success).toBe(
      false,
    );
    expect(
      grantCollaboratorBodySchema.safeParse({ email: "peer@apc.edu.ph" }).success,
    ).toBe(true);
  });
});

describe("profile patches", () => {
  it("accepts known avatars and 1–20 char names", () => {
    expect(profilePatchBodySchema.safeParse({ avatarId: AVATAR_IDS[1] }).success).toBe(
      true,
    );
    expect(profilePatchBodySchema.safeParse({ avatarId: "dragon" }).success).toBe(false);
    expect(
      profilePatchBodySchema.safeParse({ displayName: "x".repeat(21) }).success,
    ).toBe(false);
  });
});

describe("authMeResponseSchema", () => {
  it("defaults anonymous responses to no learner and no demo mode", () => {
    const me = authMeResponseSchema.parse({ authenticated: false, user: null });
    expect(me.learner).toBeNull();
    expect(me.demoMode).toBe(false);
  });

  it("carries the learner profile when signed in", () => {
    const me = authMeResponseSchema.parse({
      authenticated: true,
      user: {
        id: "u1",
        role: "teacher",
        admissionEmail: "t@apc.edu.ph",
        displayName: "Teacher",
        suspended: false,
      },
      learner: {
        id: "u1",
        displayName: "Teacher",
        avatarId: "sun",
        streak: 0,
        hearts: 5,
        xp: 0,
      },
      demoMode: false,
    });
    expect(me.learner?.avatarId).toBe("sun");
  });
});
