import { describe, expect, it } from "vitest";
import {
  APC_ADMISSION_DOMAINS,
  AUTH_DENIAL_MESSAGES,
  authStatusSchema,
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
      allowedDomains: [...APC_ADMISSION_DOMAINS],
      webOrigin: "http://localhost:3000",
    });
    expect(status.mockEnabled).toBe(true);
  });
});
