import type { FinishAnswers, GameContent } from "@jose/shared";
import { clearSensitiveClientState } from "./explorer-identity";

export const ATTEMPT_DRAFT_STORAGE_KEY = "jose.attemptDrafts";

export type SavePhase =
  | "playing"
  | "completed-locally"
  | "saving"
  | "saved"
  | "save-failed";

export type AttemptDraft = {
  accountId: string;
  levelId: string;
  moduleId: string;
  title: string;
  revision: string;
  clientAttemptId: string;
  score: number;
  maxScore: number;
  stars: number;
  misses: number;
  answers?: FinishAnswers;
  status: Exclude<SavePhase, "playing">;
  updatedAt: number;
};

export type AttemptDraftKey = {
  accountId: string;
  levelId: string;
  revision: string;
};

function draftKey(input: AttemptDraftKey): string {
  return `${input.accountId}::${input.levelId}::${input.revision}`;
}

function readStore(): Record<string, AttemptDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ATTEMPT_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, AttemptDraft>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, AttemptDraft>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ATTEMPT_DRAFT_STORAGE_KEY, JSON.stringify(store));
}

export function isUnsavedSavePhase(phase: SavePhase): boolean {
  return (
    phase === "completed-locally" ||
    phase === "saving" ||
    phase === "save-failed"
  );
}

export function contentRevision(content: unknown): string {
  const json = JSON.stringify(content);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function gameContentRevision(game: GameContent): string {
  return contentRevision(game);
}

export function writeAttemptDraft(draft: AttemptDraft): void {
  const store = readStore();
  store[draftKey(draft)] = draft;
  writeStore(store);
}

export function readAttemptDraft(key: AttemptDraftKey): AttemptDraft | null {
  const draft = readStore()[draftKey(key)];
  if (!draft) return null;
  if (
    draft.accountId !== key.accountId ||
    draft.levelId !== key.levelId ||
    draft.revision !== key.revision
  ) {
    return null;
  }
  return draft;
}

export function clearAttemptDraft(key: AttemptDraftKey): void {
  const store = readStore();
  delete store[draftKey(key)];
  writeStore(store);
}

export function clearAllAttemptDrafts(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ATTEMPT_DRAFT_STORAGE_KEY);
}

/** Logout / account switch: drop drafts so the next user cannot see them. */
export function clearAccountScopedClientState(): void {
  clearAllAttemptDrafts();
  clearSensitiveClientState();
}

export function newClientAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
