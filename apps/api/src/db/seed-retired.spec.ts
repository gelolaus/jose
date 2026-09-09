import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("production seed entry retired", () => {
  it("has no db:seed script in root or api package.json", () => {
    const root = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "..", "package.json"), "utf8"),
    );
    const api = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"),
    );
    expect(root.scripts?.["db:seed"]).toBeUndefined();
    expect(api.scripts?.["db:seed"]).toBeUndefined();
  });

  it("has no seed-cli.ts on disk", () => {
    expect(() => {
      readFileSync(join(__dirname, "seed-cli.ts"), "utf8");
    }).toThrow();
  });
});
