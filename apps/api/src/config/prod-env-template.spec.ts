import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("production env template", () => {
  it("exists and keeps secrets server-only", () => {
    const p = join(__dirname, "..", "..", "..", "..", ".env.production.example");
    expect(existsSync(p)).toBe(true);
    const text = readFileSync(p, "utf8");
    expect(text).toMatch(/JOSE_DATABASE_URL=libsql:\/\//);
    expect(text).toMatch(/JOSE_DATABASE_AUTH_TOKEN=/);
    expect(text).toMatch(/JOSE_INTERNAL_API_URL=/);
    expect(text).toMatch(/JOSE_WEB_ORIGIN=https:\/\//);
    expect(text).not.toMatch(/NEXT_PUBLIC_JOSE_DATABASE_AUTH_TOKEN/);
    expect(text).not.toMatch(/NEXT_PUBLIC_JOSE_SESSION_SECRET/);
    expect(text).not.toMatch(/NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET/);
  });
});
