export const EXPLORER_STORAGE_KEY = "jose.explorer";
export const DEFAULT_AVATAR_ID = "compass";
export const DEFAULT_DISPLAY_NAME = "Explorer";

export const AVATAR_IDS = [
  "compass",
  "sun",
  "book",
  "star",
  "leaf",
  "ship",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export type ExplorerIdentity = {
  displayName: string;
  avatarId: AvatarId;
};

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export function normalizeDisplayName(raw: string): string | null {
  const displayName = raw.trim();
  if (displayName.length < 1 || displayName.length > 20) return null;
  return displayName;
}

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
