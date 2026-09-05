/** Minimal Set-Cookie serializer (avoids ESM-only `cookie` package under Jest). */
export function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
    expires?: Date;
    maxAge?: number;
  } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) {
    const labeled =
      options.sameSite === "lax"
        ? "Lax"
        : options.sameSite === "strict"
          ? "Strict"
          : "None";
    parts.push(`SameSite=${labeled}`);
  }
  return parts.join("; ");
}
