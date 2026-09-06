import { describe, expect, it } from "@jest/globals";
import { AuthConfigError, loadAuthConfig, toAuthStatus } from "./auth-config";

const MICROSOFT_ENV = {
  JOSE_AUTH_MODE: "microsoft",
  JOSE_SESSION_SECRET: "test-session-secret-at-least-32-chars!!",
  JOSE_WEB_ORIGIN: "http://localhost:3000",
  JOSE_API_PUBLIC_URL: "http://localhost:3001",
  JOSE_MICROSOFT_CLIENT_ID: "client",
  JOSE_MICROSOFT_CLIENT_SECRET: "secret",
  JOSE_MICROSOFT_REDIRECT_URI: "http://localhost:3001/auth/microsoft/callback",
};

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
      ...MICROSOFT_ENV,
      JOSE_MICROSOFT_TENANT: "common",
    });
    expect(config.microsoft?.authority).toContain("/common/v2.0");
  });
});

describe("demo mode", () => {
  it("is enabled only when explicitly asked for outside production", () => {
    expect(loadAuthConfig({ JOSE_AUTH_MODE: "disabled" }).demoMode).toBe(false);
    expect(
      loadAuthConfig({ JOSE_AUTH_MODE: "disabled", JOSE_DEMO_MODE: "true" }).demoMode,
    ).toBe(true);
    expect(
      loadAuthConfig({ JOSE_AUTH_MODE: "disabled", JOSE_DEMO_MODE: "false" }).demoMode,
    ).toBe(false);
  });
});

describe("production hard rejects (issues #4 and #5)", () => {
  it("refuses to boot with mock auth", () => {
    expect(() =>
      loadAuthConfig({
        NODE_ENV: "production",
        JOSE_AUTH_MODE: "mock",
        JOSE_SESSION_SECRET: "test-session-secret-at-least-32-chars!!",
        JOSE_WEB_ORIGIN: "https://jose.example",
        JOSE_API_PUBLIC_URL: "https://api.jose.example",
      }),
    ).toThrow(/JOSE_AUTH_MODE=mock/);
  });

  it("refuses to boot with demo mode on", () => {
    expect(() =>
      loadAuthConfig({ ...MICROSOFT_ENV, NODE_ENV: "production", JOSE_DEMO_MODE: "true" }),
    ).toThrow(/JOSE_DEMO_MODE/);
    expect(() =>
      loadAuthConfig({ ...MICROSOFT_ENV, NODE_ENV: "production", JOSE_DEMO_MODE: "1" }),
    ).toThrow(/JOSE_DEMO_MODE/);
  });

  it("refuses to boot with the dev login shortcut on", () => {
    expect(() =>
      loadAuthConfig({
        ...MICROSOFT_ENV,
        NODE_ENV: "production",
        JOSE_AUTH_DEV_LOGIN: "1",
      }),
    ).toThrow(/JOSE_AUTH_DEV_LOGIN/);
    expect(() =>
      loadAuthConfig({
        ...MICROSOFT_ENV,
        NODE_ENV: "production",
        JOSE_AUTH_DEV_LOGIN: "true",
      }),
    ).toThrow(/JOSE_AUTH_DEV_LOGIN/);
  });

  it("refuses in-memory mail as the only OTP path for microsoft mode", () => {
    expect(() =>
      loadAuthConfig({
        ...MICROSOFT_ENV,
        NODE_ENV: "production",
        JOSE_MAIL_TRANSPORT: "memory",
      }),
    ).toThrow(/JOSE_MAIL_TRANSPORT=memory/);
  });

  it("treats JOSE_ENV=production the same as NODE_ENV=production", () => {
    expect(() =>
      loadAuthConfig({ ...MICROSOFT_ENV, JOSE_ENV: "production", JOSE_DEMO_MODE: "true" }),
    ).toThrow(AuthConfigError);
  });

  it("still rejects insecure flags when auth is disabled", () => {
    expect(() =>
      loadAuthConfig({
        NODE_ENV: "production",
        JOSE_AUTH_MODE: "disabled",
        JOSE_AUTH_DEV_LOGIN: "1",
      }),
    ).toThrow(AuthConfigError);
  });

  it("accepts a fully configured production deployment and secures cookies", () => {
    const config = loadAuthConfig({
      ...MICROSOFT_ENV,
      NODE_ENV: "production",
      JOSE_WEB_ORIGIN: "https://jose.example",
      JOSE_API_PUBLIC_URL: "https://api.jose.example",
    });
    expect(config.isProduction).toBe(true);
    expect(config.cookieSecure).toBe(true);
    expect(config.demoMode).toBe(false);
  });
});
