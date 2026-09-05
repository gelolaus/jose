import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR_ID, isAvatarId, normalizeDisplayName } from "./identity";

describe("identity helpers", () => {
  it("accepts known avatar ids only", () => {
    expect(isAvatarId("compass")).toBe(true);
    expect(isAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
    expect(isAvatarId("dragon")).toBe(false);
  });

  it("normalizes display names for account sync", () => {
    expect(normalizeDisplayName("  Ada  ")).toBe("Ada");
    expect(normalizeDisplayName("")).toBeNull();
  });
});
