const SESSION_KEY = "jose.sessionToken";

/** Temporary bearer until Microsoft admission (ticket 03) issues HttpOnly cookies via BFF. */
export function getJoseSessionToken(): string | null {
  if (typeof window === "undefined") {
    return process.env.JOSE_WEB_SESSION_TOKEN?.trim() || null;
  }
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setJoseSessionToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!token) window.sessionStorage.removeItem(SESSION_KEY);
    else window.sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    // ignore quota / private mode
  }
}
