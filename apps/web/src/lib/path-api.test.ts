import { describe, expect, it } from "vitest";
import { ApiError, isNotFoundError } from "./path-api";

describe("isNotFoundError", () => {
  it("recognizes API 404 errors", () => {
    expect(isNotFoundError(new ApiError("Missing", 404))).toBe(true);
  });

  it("does not hide outages or ordinary errors behind a 404", () => {
    expect(isNotFoundError(new ApiError("Unavailable", 503))).toBe(false);
    expect(isNotFoundError(new Error("Connection refused"))).toBe(false);
  });
});
