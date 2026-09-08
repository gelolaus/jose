import { describe, expect, it } from "@jest/globals";
import {
  hostnameFromHostHeader,
  isLocalDevAccessAllowed,
  isLoopbackHost,
} from "./local-request";

describe("hostnameFromHostHeader", () => {
  it("strips ports from ipv4 and names", () => {
    expect(hostnameFromHostHeader("localhost:3001")).toBe("localhost");
    expect(hostnameFromHostHeader("127.0.0.1:3001")).toBe("127.0.0.1");
  });

  it("reads loopback ipv6 hosts", () => {
    expect(hostnameFromHostHeader("[::1]:3001")).toBe("::1");
    expect(hostnameFromHostHeader("[::1]")).toBe("::1");
  });
});

describe("isLoopbackHost", () => {
  it("accepts localhost, ipv4 loopback, and ipv6 loopback", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.4.4.4")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("::ffff:127.0.0.1")).toBe(true);
  });

  it("rejects non-loopback hosts", () => {
    expect(isLoopbackHost("example.com")).toBe(false);
    expect(isLoopbackHost("8.8.8.8")).toBe(false);
    expect(isLoopbackHost("10.0.0.1")).toBe(false);
  });
});

describe("isLocalDevAccessAllowed", () => {
  const local = {
    remoteAddress: "127.0.0.1",
    hostHeader: "localhost:3001",
  };

  it("accepts a local non-production request", () => {
    expect(isLocalDevAccessAllowed({ isProduction: false, ...local })).toBe(true);
  });

  it("rejects production even on loopback", () => {
    expect(isLocalDevAccessAllowed({ isProduction: true, ...local })).toBe(false);
  });

  it("rejects a non-loopback remote address", () => {
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        remoteAddress: "8.8.8.8",
        hostHeader: "localhost:3001",
      }),
    ).toBe(false);
  });

  it("rejects a non-loopback Host header", () => {
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        remoteAddress: "127.0.0.1",
        hostHeader: "jose.example:443",
      }),
    ).toBe(false);
  });

  it("does not trust X-Forwarded-Host", () => {
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        remoteAddress: "8.8.8.8",
        hostHeader: "jose.example",
        forwardedHost: "localhost",
      }),
    ).toBe(false);
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        remoteAddress: "127.0.0.1",
        hostHeader: "localhost:3001",
        forwardedHost: "evil.example",
      }),
    ).toBe(true);
  });

  it("does not trust X-Forwarded-For for the peer address", () => {
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        remoteAddress: "203.0.113.10",
        hostHeader: "localhost",
        forwardedFor: "127.0.0.1",
      }),
    ).toBe(false);
  });

  it("can be disabled with a local kill switch", () => {
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        ...local,
        killSwitch: "0",
      }),
    ).toBe(false);
    expect(
      isLocalDevAccessAllowed({
        isProduction: false,
        ...local,
        killSwitch: "false",
      }),
    ).toBe(false);
  });
});
