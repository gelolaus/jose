import {
  AVATAR_IDS,
  DEFAULT_AVATAR_ID,
  DEFAULT_DISPLAY_NAME,
  isAvatarId,
  normalizeDisplayName,
  type AvatarId,
} from "@jose/shared";

export {
  AVATAR_IDS,
  DEFAULT_AVATAR_ID,
  DEFAULT_DISPLAY_NAME,
  isAvatarId,
  normalizeDisplayName,
};
export type { AvatarId };

export const EXPLORER_STORAGE_KEY = "jose.explorer";

export type ExplorerIdentity = {
  displayName: string;
  avatarId: AvatarId;
};

export function parseExplorerIdentity(raw: unknown): ExplorerIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.displayName !== "string" ||
    typeof record.avatarId !== "string"
  ) {
    return null;
  }
  const displayName = normalizeDisplayName(record.displayName);
  if (!displayName || !isAvatarId(record.avatarId)) return null;
  return { displayName, avatarId: record.avatarId };
}

export function readExplorerIdentity(): ExplorerIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(EXPLORER_STORAGE_KEY);
    if (!raw) return null;
    return parseExplorerIdentity(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeExplorerIdentity(identity: ExplorerIdentity): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPLORER_STORAGE_KEY, JSON.stringify(identity));
}

export function defaultExplorerIdentity(
  displayName = DEFAULT_DISPLAY_NAME,
): ExplorerIdentity {
  return {
    displayName: normalizeDisplayName(displayName) ?? DEFAULT_DISPLAY_NAME,
    avatarId: DEFAULT_AVATAR_ID,
  };
}

/** Clears cosmetic/local learner state after logout so the next user cannot see it. */
export function clearSensitiveClientState(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && (key === EXPLORER_STORAGE_KEY || key.startsWith("jose."))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
  window.sessionStorage.removeItem(EXPLORER_STORAGE_KEY);
}
