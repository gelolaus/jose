import { loadJoseEnv, assertNoPublicSecrets, EnvValidationError } from "./env";

describe("loadJoseEnv", () => {
  const base = { ...process.env };

  afterEach(() => {
    process.env = { ...base };
  });

  it("accepts local development defaults", () => {
    process.env = {
      ...base,
      NODE_ENV: "development",
      JOSE_DATABASE_URL: "file:./data/jose.sqlite",
    };
    delete process.env.JOSE_ALLOWED_ORIGINS;
    delete process.env.JOSE_WEB_ORIGIN;
    const env = loadJoseEnv(process.env);
    expect(env.allowedOrigins).toContain("http://localhost:3000");
    expect(env.trustProxy).toBe(false);
  });

  it("fails production without database URL", () => {
    process.env = {
      NODE_ENV: "production",
      JOSE_WEB_ORIGIN: "https://jose.example.edu",
    } as NodeJS.ProcessEnv;
    expect(() => loadJoseEnv(process.env)).toThrow(EnvValidationError);
    expect(() => loadJoseEnv(process.env)).toThrow(/JOSE_DATABASE_URL/);
  });

  it("fails production without a web origin", () => {
    process.env = {
      NODE_ENV: "production",
      JOSE_DATABASE_URL: "file:/data/jose.sqlite",
    } as NodeJS.ProcessEnv;
    expect(() => loadJoseEnv(process.env)).toThrow(/JOSE_ALLOWED_ORIGINS|JOSE_WEB_ORIGIN/);
  });

  it("requires auth token for hosted libSQL", () => {
    process.env = {
      NODE_ENV: "development",
      JOSE_DATABASE_URL: "libsql://example.turso.io",
    } as NodeJS.ProcessEnv;
    expect(() => loadJoseEnv(process.env)).toThrow(/JOSE_DATABASE_AUTH_TOKEN/);
  });

  it("accepts hosted libSQL when token is present", () => {
    process.env = {
      NODE_ENV: "development",
      JOSE_DATABASE_URL: "libsql://example.turso.io",
      JOSE_DATABASE_AUTH_TOKEN: "test-token-not-real",
      JOSE_ALLOWED_ORIGINS: "https://jose.example.edu",
    } as NodeJS.ProcessEnv;
    const env = loadJoseEnv(process.env);
    expect(env.databaseAuthToken).toBe("test-token-not-real");
  });

  it("rejects NEXT_PUBLIC database secrets", () => {
    process.env = {
      NODE_ENV: "development",
      NEXT_PUBLIC_JOSE_DATABASE_AUTH_TOKEN: "leak",
    } as NodeJS.ProcessEnv;
    expect(() => assertNoPublicSecrets(process.env)).toThrow(/NEXT_PUBLIC/);
  });

  it("parses trusted proxy hop count without enabling spoofable defaults", () => {
    process.env = {
      ...base,
      NODE_ENV: "development",
      JOSE_TRUST_PROXY: "1",
    };
    expect(loadJoseEnv(process.env).trustProxy).toBe(1);
  });
});
