/**
 * The live API still finishes Microsoft login at `/login?signedIn=1`.
 * Newer API builds send people straight to `/learn`. Either Location should
 * land on Learn when a session was issued, and on the landing page when it
 * was refused — never on a signed-out page that only echoes `signedIn=1`.
 */
export function normalizeAuthReturnLocation(location: string, origin: string): string {
  let url: URL;
  try {
    url = new URL(location, origin);
  } catch {
    return location;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return location;
  }
  if (url.origin !== originUrl.origin) return url.toString();

  if (url.pathname === "/login" || url.pathname === "/") {
    const signedIn = url.searchParams.get("signedIn");
    if (signedIn === "1" || signedIn === "true") {
      return new URL("/learn", url.origin).toString();
    }
    const reason = url.searchParams.get("reason");
    const next = new URL("/", url.origin);
    if (reason) next.searchParams.set("reason", reason);
    return next.toString();
  }

  return url.toString();
}
