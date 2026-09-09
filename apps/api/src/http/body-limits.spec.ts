import { IMPORT_BODY_LIMIT_BYTES, importBodyLimitBytes, isImportBodyPath } from "./body-limits";

describe("body limits", () => {
  it("reserves at least 512KB for import routes", () => {
    expect(IMPORT_BODY_LIMIT_BYTES).toBeGreaterThanOrEqual(512 * 1024);
    expect(importBodyLimitBytes(256 * 1024)).toBeGreaterThanOrEqual(512 * 1024);
    expect(importBodyLimitBytes(1024 * 1024)).toBe(1024 * 1024);
  });

  it("matches only JMM import routes", () => {
    expect(isImportBodyPath("/teach/modules/import/preview")).toBe(true);
    expect(isImportBodyPath("/teach/modules/import/commit")).toBe(true);
    expect(isImportBodyPath("/teach/modules")).toBe(false);
    expect(isImportBodyPath("/teach/classes")).toBe(false);
  });
});
