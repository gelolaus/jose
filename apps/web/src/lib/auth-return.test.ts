import { describe, expect, it } from "vitest";
import { normalizeAuthReturnLocation } from "./auth-return";

const origin = "https://jose.gelolaus.com";

describe("normalizeAuthReturnLocation", () => {
  it("sends a finished Microsoft login to Learn", () => {
    expect(
      normalizeAuthReturnLocation(`${origin}/login?signedIn=1`, origin),
    ).toBe(`${origin}/learn`);
    expect(
      normalizeAuthReturnLocation("/login?signedIn=true", origin),
    ).toBe(`${origin}/learn`);
    expect(normalizeAuthReturnLocation(`${origin}/?signedIn=1`, origin)).toBe(
      `${origin}/learn`,
    );
  });

  it("keeps a direct Learn redirect", () => {
    expect(normalizeAuthReturnLocation(`${origin}/learn`, origin)).toBe(`${origin}/learn`);
  });

  it("puts a denial beside the landing sign-in button", () => {
    expect(
      normalizeAuthReturnLocation(`${origin}/login?reason=switch_account`, origin),
    ).toBe(`${origin}/?reason=switch_account`);
  });

  it("does not rewrite an off-site Location", () => {
    expect(
      normalizeAuthReturnLocation("https://login.microsoftonline.com/common", origin),
    ).toBe("https://login.microsoftonline.com/common");
  });
});
