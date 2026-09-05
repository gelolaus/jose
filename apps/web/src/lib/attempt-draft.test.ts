import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTEMPT_DRAFT_STORAGE_KEY,
  clearAccountScopedClientState,
  contentRevision,
  readAttemptDraft,
  writeAttemptDraft,
  type AttemptDraft,
} from "./attempt-draft";
import {
  CLIENT_ACCOUNT_STORAGE_KEY,
  clearClientAccountId,
  readClientAccountId,
  requireClientAccountId,
} from "./client-account";
import { EXPLORER_STORAGE_KEY } from "./explorer-identity";

const baseDraft = (): AttemptDraft => ({
  accountId: "acct-a",
  levelId: "level-1",
  moduleId: "mod-1",
  title: "Quiz",
  revision: "rev-1",
  clientAttemptId: "11111111-1111-4111-8111-111111111111",
  score: 3,
  maxScore: 4,
  stars: 2,
  misses: 1,
  status: "save-failed",
  updatedAt: 1_700_000_000_000,
});

describe("attempt draft storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("reads only drafts for the current account and matching revision", () => {
    writeAttemptDraft(baseDraft());
    writeAttemptDraft({
      ...baseDraft(),
      accountId: "acct-b",
      clientAttemptId: "22222222-2222-4222-8222-222222222222",
    });

    expect(
      readAttemptDraft({
        accountId: "acct-a",
        levelId: "level-1",
        revision: "rev-1",
      })?.accountId,
    ).toBe("acct-a");
    expect(
      readAttemptDraft({
        accountId: "acct-b",
        levelId: "level-1",
        revision: "rev-1",
      })?.accountId,
    ).toBe("acct-b");
    expect(
      readAttemptDraft({
        accountId: "acct-a",
        levelId: "level-1",
        revision: "rev-other",
      }),
    ).toBeNull();
  });

  it("does not expose another account's draft after logout clears scoped state", () => {
    localStorage.setItem(CLIENT_ACCOUNT_STORAGE_KEY, "acct-a");
    localStorage.setItem(
      EXPLORER_STORAGE_KEY,
      JSON.stringify({ displayName: "Ada", avatarId: "compass" }),
    );
    writeAttemptDraft(baseDraft());

    clearAccountScopedClientState();

    expect(localStorage.getItem(ATTEMPT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CLIENT_ACCOUNT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(EXPLORER_STORAGE_KEY)).toBeNull();
    expect(readClientAccountId()).toBeNull();
    expect(
      readAttemptDraft({
        accountId: "acct-a",
        levelId: "level-1",
        revision: "rev-1",
      }),
    ).toBeNull();
  });

  it("creates a stable client account id until cleared", () => {
    const first = requireClientAccountId();
    const second = requireClientAccountId();
    expect(first).toBe(second);
    clearClientAccountId();
    expect(readClientAccountId()).toBeNull();
    expect(requireClientAccountId()).not.toBe(first);
  });

  it("fingerprints game content for revision matching", () => {
    const a = contentRevision({
      type: "quiz",
      questions: [{ prompt: "A", choices: ["1", "2"], correctIndex: 0 }],
    });
    const b = contentRevision({
      type: "quiz",
      questions: [{ prompt: "B", choices: ["1", "2"], correctIndex: 0 }],
    });
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-f0-9]+$/);
  });
});

describe("save phase helpers", () => {
  it("treats completed-locally, saving, and save-failed as unsaved results", async () => {
    const { isUnsavedSavePhase } = await import("./attempt-draft");
    expect(isUnsavedSavePhase("playing")).toBe(false);
    expect(isUnsavedSavePhase("completed-locally")).toBe(true);
    expect(isUnsavedSavePhase("saving")).toBe(true);
    expect(isUnsavedSavePhase("saved")).toBe(false);
    expect(isUnsavedSavePhase("save-failed")).toBe(true);
  });
});
