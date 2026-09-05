import { loadAuthEnv } from "./auth.config";

describe("loadAuthEnv", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("keeps Microsoft disabled when no JOSE_MS_* vars are set", () => {
    delete process.env.JOSE_MS_CLIENT_ID;
    delete process.env.JOSE_MS_CLIENT_SECRET;
    delete process.env.JOSE_MS_REDIRECT_URI;
    delete process.env.JOSE_MS_TENANT;
    const env = loadAuthEnv();
    expect(env.microsoft).toBeNull();
  });

  it("fails closed on partial Microsoft configuration", () => {
    process.env.JOSE_MS_CLIENT_ID = "abc";
    delete process.env.JOSE_MS_CLIENT_SECRET;
    delete process.env.JOSE_MS_REDIRECT_URI;
    expect(() => loadAuthEnv()).toThrow(/partially configured/i);
  });
});
