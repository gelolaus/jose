import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiRootEnvPath, loadApiEnvFile } from "./load-env-file";

describe("loadApiEnvFile", () => {
  it("loads the API .env values without replacing explicitly supplied environment values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jose-env-file-"));
    const path = join(dir, ".env");
    writeFileSync(path, "JOSE_AUTH_MODE=microsoft\nJOSE_MICROSOFT_CLIENT_ID=file-client\n");
    const env: NodeJS.ProcessEnv = { JOSE_MICROSOFT_CLIENT_ID: "shell-client" };

    try {
      loadApiEnvFile(env, path);

      expect(env.JOSE_AUTH_MODE).toBe("microsoft");
      expect(env.JOSE_MICROSOFT_CLIENT_ID).toBe("shell-client");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("resolves the single local file at the repository root", () => {
    expect(apiRootEnvPath()).toMatch(/[\\/]jose[\\/]\.env$/);
    expect(apiRootEnvPath()).not.toMatch(/[\\/]apps[\\/]api[\\/]\.env$/);
  });
});
