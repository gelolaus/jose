import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRootEnvFile, webRootEnvPath } from "./root-env";

describe("root web environment", () => {
  it("loads root values without replacing deployment environment values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jose-web-root-env-"));
    const path = join(dir, ".env");
    writeFileSync(path, "JOSE_INTERNAL_API_URL=http://root-api:3001\n");
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      JOSE_INTERNAL_API_URL: "https://deployment-api.example",
    };

    try {
      loadRootEnvFile(env, path);
      expect(env.JOSE_INTERNAL_API_URL).toBe("https://deployment-api.example");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("resolves the single local file at the repository root", () => {
    expect(webRootEnvPath()).toMatch(/[\\/]jose[\\/]\.env$/);
    expect(webRootEnvPath()).not.toMatch(/[\\/]apps[\\/]web[\\/]\.env$/);
  });
});
