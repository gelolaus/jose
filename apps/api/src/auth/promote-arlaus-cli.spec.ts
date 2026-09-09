import { isPromoteTokenValid, resolvePromoteTokens } from "./promote-arlaus-cli";

describe("promote arlaus CLI token", () => {
  it("never allows the env token to satisfy the check implicitly", () => {
    const { expected, provided } = resolvePromoteTokens(undefined, "secret-123");
    expect(expected).toBe("secret-123");
    expect(provided).toBe("");
    expect(isPromoteTokenValid(expected, provided)).toBe(false);
  });

  it("requires an explicit matching CLI argument", () => {
    expect(isPromoteTokenValid("secret-123", "secret-123")).toBe(true);
    expect(isPromoteTokenValid("secret-123", "wrong")).toBe(false);
    expect(isPromoteTokenValid("", "")).toBe(false);
    expect(isPromoteTokenValid("secret-123", "")).toBe(false);
    expect(isPromoteTokenValid("", "secret-123")).toBe(false);
  });

  it("trims whitespace before comparing", () => {
    const { expected, provided } = resolvePromoteTokens("  secret-123  ", "secret-123");
    expect(isPromoteTokenValid(expected, provided)).toBe(true);
  });
});
