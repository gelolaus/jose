# Design: preserve game results when saving fails (Recommendation 07)

**Date:** 2026-09-05  
**Issue:** #9  
**Status:** Implemented

## Goal

Keep a finished game result when the network or API save fails. Learners can reconnect and save once without replaying the board or duplicating XP. Drafts stay scoped to the current client account so logout cannot leak another learner's unsaved result.

## Save phases

`GamePlayer` uses explicit phases: `playing` → `completed-locally` → `saving` → `saved` or `save-failed`.

- Celebration UI shows for every completed-local result, including failures.
- **Retry saving** resubmits the same `clientAttemptId`.
- **Play again** clears the draft and remounts the board.
- Failed miss requests return `unsynced` instead of pretending the heart spend succeeded.

## Account-scoped resume

Client drafts live in `localStorage` under `jose.attemptDrafts`, keyed by `accountId + levelId + contentRevision`.

- `jose.clientAccountId` is the temporary client account scope until real auth lands.
- Profile **Clear this device** calls `clearAccountScopedClientState()` (drafts + account id + explorer identity).
- A different account id never reads another account's draft, even if localStorage still holds it until cleared.

## Idempotent reconciliation

`POST /levels/:id/attempts` requires `clientAttemptId` (UUID). Attempts store `client_attempt_id` with a unique index per learner. Replays of the same id return success without inserting again or awarding XP again.

## Out of scope

Real Microsoft/APC sessions (ticket 01/03), server-authoritative scoring (05), and published content revisions (19). Content revision today is a client fingerprint of the game JSON.
