import { describe, expect, it } from "vitest";
import {
  normalizeDisplayName,
  parseExplorerIdentity,
} from "./explorer-identity";

describe("normalizeDisplayName", () => {
  it("trims and accepts names within 1–20 chars", () => {
    expect(normalizeDisplayName("  Pepe  ")).toBe("Pepe");
  });

  it("rejects empty and oversized names", () => {
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("x".repeat(21))).toBeNull();
  });
});

describe("parseExplorerIdentity", () => {
  it("accepts a valid identity object", () => {
    expect(
      parseExplorerIdentity({ displayName: "Luna", avatarId: "star" }),
    ).toEqual({ displayName: "Luna", avatarId: "star" });
  });

  it("rejects unknown avatars and empty names", () => {
    expect(
      parseExplorerIdentity({ displayName: "Luna", avatarId: "dragon" }),
    ).toBeNull();
    expect(
      parseExplorerIdentity({ displayName: "  ", avatarId: "compass" }),
    ).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(parseExplorerIdentity(null)).toBeNull();
    expect(parseExplorerIdentity("nope")).toBeNull();
  });
});
