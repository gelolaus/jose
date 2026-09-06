import { describe, expect, it } from "@jest/globals";
import {
  evaluateMicrosoftEmailClaim,
  isAllowedApcDomain,
  parseMailbox,
} from "./admission";

describe("APC mailbox admission", () => {
  it("allows staff and student domains with exact equality", () => {
    expect(isAllowedApcDomain("apc.edu.ph")).toBe(true);
    expect(isAllowedApcDomain("student.apc.edu.ph")).toBe(true);
    expect(isAllowedApcDomain("APC.EDU.PH")).toBe(true);
  });

  it("rejects lookalike and extra subdomains", () => {
    expect(isAllowedApcDomain("apc.edu.ph.evil.test")).toBe(false);
    expect(isAllowedApcDomain("fakeapc.edu.ph")).toBe(false);
    expect(isAllowedApcDomain("mail.student.apc.edu.ph")).toBe(false);
    expect(isAllowedApcDomain("edu.ph")).toBe(false);
  });

  it("parses and normalizes uppercase domains", () => {
    const parsed = parseMailbox("Ada.Lovelace@Student.APC.EDU.PH");
    expect(parsed).toEqual({
      ok: true,
      local: "Ada.Lovelace",
      domain: "student.apc.edu.ph",
      normalized: "Ada.Lovelace@student.apc.edu.ph",
    });
  });

  it("rejects malformed addresses", () => {
    expect(parseMailbox("").ok).toBe(false);
    expect(parseMailbox("no-at-sign").ok).toBe(false);
    expect(parseMailbox("@apc.edu.ph").ok).toBe(false);
    expect(parseMailbox("a@b@apc.edu.ph").ok).toBe(false);
    expect(parseMailbox("Name <a@apc.edu.ph>").ok).toBe(false);
    expect(parseMailbox("a@apc..edu.ph").ok).toBe(false);
  });

  it("admits candidate APC claims and rejects outsiders", () => {
    expect(evaluateMicrosoftEmailClaim("teacher@apc.edu.ph")).toEqual({
      kind: "admit_candidate",
      email: "teacher@apc.edu.ph",
      domain: "apc.edu.ph",
    });
    expect(evaluateMicrosoftEmailClaim("kid@STUDENT.APC.EDU.PH")).toEqual({
      kind: "admit_candidate",
      email: "kid@student.apc.edu.ph",
      domain: "student.apc.edu.ph",
    });
    expect(evaluateMicrosoftEmailClaim("outsider@gmail.com").kind).toBe(
      "reject_switch_account",
    );
    expect(evaluateMicrosoftEmailClaim("x@apc.edu.ph.evil.test").kind).toBe(
      "reject_switch_account",
    );
    expect(evaluateMicrosoftEmailClaim(null).kind).toBe("missing");
    expect(evaluateMicrosoftEmailClaim("not-an-email").kind).toBe("reject_malformed");
  });
});
