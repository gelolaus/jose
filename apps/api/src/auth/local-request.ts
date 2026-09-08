/**
 * Localhost-only development auth gates.
 *
 * Never consult X-Forwarded-Host or X-Forwarded-For: those headers are
 * client-controlled unless a trusted proxy has already overwritten them,
 * and this shortcut must not be reachable from a remote peer.
 */

export type LocalDevAccessInput = {
  isProduction: boolean;
  remoteAddress?: string | null;
  hostHeader?: string | string[] | null;
  /** Ignored. Documented so callers do not pass it by accident. */
  forwardedHost?: string | string[] | null;
  /** Ignored. Documented so callers do not pass it by accident. */
  forwardedFor?: string | string[] | null;
  /** JOSE_AUTH_DEV_LOGIN=0/false/no/off disables the shortcut even on localhost. */
  killSwitch?: string | null;
};

export function hostnameFromHostHeader(host: string): string {
  const raw = host.trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    if (end > 0) return raw.slice(1, end);
  }
  const colon = raw.lastIndexOf(":");
  if (colon !== -1 && /^\d+$/.test(raw.slice(colon + 1))) {
    return raw.slice(0, colon);
  }
  return raw;
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (host === "localhost") return true;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.startsWith("::ffff:")) {
    return isLoopbackHost(host.slice("::ffff:".length));
  }
  return /^127(?:\.\d{1,3}){3}$/.test(host);
}

function isKillSwitchOff(raw: string | null | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "no" || value === "off";
}

function firstHeader(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function isLocalDevAccessAllowed(input: LocalDevAccessInput): boolean {
  if (input.isProduction) return false;
  if (isKillSwitchOff(input.killSwitch)) return false;
  const remote = input.remoteAddress?.trim() ?? "";
  const hostHeader = firstHeader(input.hostHeader);
  if (!remote || !hostHeader) return false;
  return isLoopbackHost(remote) && isLoopbackHost(hostnameFromHostHeader(hostHeader));
}

export function localDevAccessFromExpress(input: {
  isProduction: boolean;
  remoteAddress?: string | null;
  hostHeader?: string | string[] | null;
  killSwitch?: string | null;
}): boolean {
  return isLocalDevAccessAllowed(input);
}

/** Uses the TCP peer and the Host header only. Forwarded headers are ignored. */
export function localDevAccessFromRequest(
  req: {
    socket?: { remoteAddress?: string | null };
    headers?: { host?: string | string[] };
  },
  isProduction: boolean,
  killSwitch?: string | null,
): boolean {
  return isLocalDevAccessAllowed({
    isProduction,
    remoteAddress: req.socket?.remoteAddress,
    hostHeader: req.headers?.host,
    killSwitch,
  });
}
