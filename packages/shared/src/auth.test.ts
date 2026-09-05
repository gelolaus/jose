import { describe, expect, it } from "vitest";
import {
  canAccessTeacherStudio,
  roleFromAdmissionEmail,
  accountRoleSchema,
  type AccountRole,
} from "./auth";

describe("admission role policy", () => {
  it("defaults every admitted mailbox to student", () => {
    expect(roleFromAdmissionEmail("anyone@apc.edu.ph")).toBe("student");
    expect(roleFromAdmissionEmail("dean@student.apc.edu.ph")).toBe("student");
    expect(roleFromAdmissionEmail("Teacher@APC.EDU.PH")).toBe("student");
  });

  it("does not treat APC domain as teacher studio access", () => {
    const role: AccountRole = roleFromAdmissionEmail("faculty@apc.edu.ph");
    expect(canAccessTeacherStudio(role)).toBe(false);
    expect(canAccessTeacherStudio("teacher")).toBe(true);
    expect(canAccessTeacherStudio("admin")).toBe(true);
    expect(canAccessTeacherStudio("student")).toBe(false);
    expect(canAccessTeacherStudio(null)).toBe(false);
  });

  it("keeps role schema closed", () => {
    expect(accountRoleSchema.safeParse("owner").success).toBe(false);
  });
});
