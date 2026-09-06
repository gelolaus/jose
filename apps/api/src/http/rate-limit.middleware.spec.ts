import { rateLimitClientKey } from "./rate-limit.middleware";
import type { Request } from "express";

describe("rateLimitClientKey", () => {
  it("uses Express req.ip and ignores a spoofed X-Forwarded-For header", () => {
    const req = {
      ip: "10.0.0.8",
      socket: { remoteAddress: "10.0.0.8" },
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    } as unknown as Request;
    expect(rateLimitClientKey(req)).toBe("10.0.0.8");
  });
});
