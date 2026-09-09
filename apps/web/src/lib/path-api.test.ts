import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequestInit,
  getApiBaseUrl,
  isNotFoundError,
  isUnauthorizedError,
} from "./path-api";

describe("isNotFoundError", () => {
  it("recognizes API 404 errors", () => {
    expect(isNotFoundError(new ApiError("Missing", 404))).toBe(true);
  });

  it("does not hide outages or ordinary errors behind a 404", () => {
    expect(isNotFoundError(new ApiError("Unavailable", 503))).toBe(false);
    expect(isNotFoundError(new Error("Connection refused"))).toBe(false);
  });
});

describe("isUnauthorizedError", () => {
  it("recognizes a missing or rejected session", () => {
    expect(isUnauthorizedError(new ApiError("Sign in", 401))).toBe(true);
    expect(isUnauthorizedError(new ApiError("Forbidden", 403))).toBe(false);
    expect(isUnauthorizedError(new Error("boom"))).toBe(false);
  });
});

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the same-origin proxy in the browser so the session cookie is first-party", () => {
    expect(getApiBaseUrl()).toBe("/api");
  });

  it("uses the stable production API for server rendering when Vercel has no override", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JOSE_INTERNAL_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(getApiBaseUrl()).toBe("https://api.jose.gelolaus.com");
  });
});

describe("apiRequestInit", () => {
  it("always sends credentials and never caches identity-bearing responses", () => {
    const init = apiRequestInit();
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
  });

  it("forwards only an explicitly supplied cookie, never an identity header", () => {
    const init = apiRequestInit(undefined, { cookie: "jose_session=abc" });
    const headers = init.headers as Record<string, string>;
    expect(headers.cookie).toBe("jose_session=abc");
    expect(Object.keys(headers).some((key) => key.toLowerCase().startsWith("x-"))).toBe(
      false,
    );
  });

  it("never requires public database secrets", () => {
    expect(process.env.NEXT_PUBLIC_JOSE_DATABASE_AUTH_TOKEN).toBeUndefined();
  });
});
