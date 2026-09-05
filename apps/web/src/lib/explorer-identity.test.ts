import { afterEach, describe, expect, it } from "vitest";
import {
  EXPLORER_STORAGE_KEY,
  clearSensitiveClientState,
  normalizeDisplayName,
  parseExplorerIdentity,
  writeExplorerIdentity,
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

describe("clearSensitiveClientState", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("removes explorer identity and other jose.* keys on sign-out", () => {
    writeExplorerIdentity({ displayName: "Luna", avatarId: "star" });
    window.localStorage.setItem("jose.draft", "secret");
    window.localStorage.setItem("unrelated", "keep");
    window.sessionStorage.setItem(EXPLORER_STORAGE_KEY, "stale");

    clearSensitiveClientState();

    expect(window.localStorage.getItem(EXPLORER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem("jose.draft")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
    expect(window.sessionStorage.getItem(EXPLORER_STORAGE_KEY)).toBeNull();
  });
});
