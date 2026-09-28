import { describe, expect, it } from "vitest";
import { isNavigationError, rethrowIfNavigation } from "./navigation-error";

describe("navigation errors", () => {
  it("recognizes Next redirect, notFound, and access-fallback throws", () => {
    expect(isNavigationError({ digest: "NEXT_REDIRECT;replace;/learn;307;" })).toBe(true);
    expect(isNavigationError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(isNavigationError({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(true);
    expect(isNavigationError(new Error("API down"))).toBe(false);
    expect(isNavigationError({ digest: "something-else" })).toBe(false);
  });

  it("rethrows navigation errors and leaves ordinary failures alone", () => {
    const redirectError = { digest: "NEXT_REDIRECT;push;/learn;307;" };
    expect(() => rethrowIfNavigation(redirectError)).toThrow();
    expect(() => rethrowIfNavigation(new Error("network"))).not.toThrow();
  });
});
