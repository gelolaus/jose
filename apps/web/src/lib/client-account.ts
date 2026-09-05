import { DEMO_LEARNER_ID } from "@jose/shared";

export const CLIENT_ACCOUNT_STORAGE_KEY = "jose.clientAccountId";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `acct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readClientAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CLIENT_ACCOUNT_STORAGE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function requireClientAccountId(): string {
  const existing = readClientAccountId();
  if (existing) return existing;
  const created = randomId();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLIENT_ACCOUNT_STORAGE_KEY, created);
  }
  return created;
}

/** Fallback when storage is unavailable (SSR). Real auth will replace this. */
export function resolveAccountScope(): string {
  return readClientAccountId() ?? DEMO_LEARNER_ID;
}

export function clearClientAccountId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLIENT_ACCOUNT_STORAGE_KEY);
}
