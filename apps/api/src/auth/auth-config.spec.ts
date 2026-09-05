import { describe, expect, it } from "@jest/globals";
import { AuthConfigError, loadAuthConfig, toAuthStatus } from "./auth-config";

describe("auth config validation", () => {
  it("defaults to disabled without credentials", () => {
    const config = loadAuthConfig({ JOSE_AUTH_MODE: undefined });
    expect(config.mode).toBe("disabled");
    expect(toAuthStatus(config).microsoftConfigured).toBe(false);
  });

  it("requires a long session secret for mock mode", () => {
    expect(() =>
      loadAuthConfig({
        JOSE_AUTH_MODE: "mock",
        JOSE_SESSION_SECRET: "short",
        JOSE_WEB_ORIGIN: "http://localhost:3000",
        JOSE_API_PUBLIC_URL: "http://localhost:3001",
      }),
    ).toThrow(AuthConfigError);
  });

  it("requires Microsoft credentials for microsoft mode", () => {
    expect(() =>
      loadAuthConfig({
        JOSE_AUTH_MODE: "microsoft",
        JOSE_SESSION_SECRET: "test-session-secret-at-least-32-chars!!",
        JOSE_WEB_ORIGIN: "http://localhost:3000",
        JOSE_API_PUBLIC_URL: "http://localhost:3001",
      }),
    ).toThrow(/JOSE_MICROSOFT_CLIENT_ID/);
  });

  it("loads microsoft mode when complete", () => {
    const config = loadAuthConfig({
      JOSE_AUTH_MODE: "microsoft",
      JOSE_SESSION_SECRET: "test-session-secret-at-least-32-chars!!",
      JOSE_WEB_ORIGIN: "http://localhost:3000",
      JOSE_API_PUBLIC_URL: "http://localhost:3001",
      JOSE_MICROSOFT_CLIENT_ID: "client",
      JOSE_MICROSOFT_CLIENT_SECRET: "secret",
      JOSE_MICROSOFT_REDIRECT_URI: "http://localhost:3001/auth/microsoft/callback",
      JOSE_MICROSOFT_TENANT: "common",
    });
    expect(config.microsoft?.authority).toContain("/common/v2.0");
  });
});
