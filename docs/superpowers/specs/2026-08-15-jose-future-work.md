# Jose — Future work

**Date:** 2026-08-15  
**Status:** Reference for later chats (not this implementation)  
**Companion spec:** `docs/superpowers/specs/2026-08-15-rizal-modules-lessons-games-design.md`

This file is the parking lot for work we already agreed to do, but not in the modules/lessons/games slice. Later sessions should read this before inventing a parallel design.

## Accounts

Jose will have **teacher** and **student** accounts.

- Students never see `/teach`. Teach routes require a teacher role.
- The Profile “Teacher studio” door goes away for students; teachers can land on `/teach` after login.
- Replace constant `demo-student` with the logged-in user id. Tables `learner_progress` and `attempts` already key on `learnerId`.
- `learners` rows are created on signup (display name, avatar may move off `localStorage`).
- Do not redesign module/section/level tables for auth. Auth is a gate and a user id, not a new curriculum model.

Suggested stack (undecided until that project): Auth.js (or similar) on Nest or Next, session cookie, Turso-backed user table.

## Attempt monitoring

Every game finish already writes `attempts` (`score`, `maxScore`, `payload`, `createdAt`).

Later Teach should show, per module and level:

- Who played (when accounts exist)
- Attempt count, best score, latest score, timestamps
- Optional drill-down into `payload` (which quiz answers)

No class roster UI until accounts exist. Do not add a fake monitor for one demo user as a product surface.

## Leaderboards

Out of the current slice on purpose. Needs accounts.

Possible later: per-module and per-level boards (best score, first clear). Use `attempts` as the source; add a derived best-score query rather than a second write path if possible.

## Pass marks

Today, finishing a game unlocks the next level even at 0. Later teachers may set a pass percent per game level. Sequential unlock would then require `bestScore / maxScore >= passMark`. Keep that as a column on `levels` when the time comes; do not gate on it now.

## Turso

Schema is already SQLite/libSQL.

To switch from the local file:

1. Create a Turso database.
2. Set `JOSE_DATABASE_URL` (libsql URL) and `JOSE_DATABASE_AUTH_TOKEN`.
3. Run the same `CREATE TABLE` / Drizzle schema against Turso (or drizzle-kit migrate).
4. Copy seed if the cloud DB is empty.

No Postgres. Do not keep a parallel JSON store.

## Extra games

Shipped types: `quiz`, `memory`, `timeline`, `blank`, `sort`.

Later types should follow the same rules: easy to learn, easy for a teacher to author, Zod discriminated union on `game_content.json`, one student player + one Teach editor. Add the union member in `packages/shared` first.

## Image upload

Memory cards currently take https URLs. Later: upload into object storage (or Turso-adjacent blob) and store the resulting URL in the same `imageUrl` field so the player does not change.

## Practice tab

Still a stub. Later: replay completed games, mixed drills from finished modules, or hearts practice. Do not invent a second curriculum graph.

## Other parked items

- Hearts / streak economy (lose hearts on wrong quiz answers, daily streak from `attempts`)
- Chest editor for teachers (seeded chests only today)
- Module prerequisites (lock a deep dive until the featured path reaches a section)
- Draft autosave / version history
- Class codes, school org, multiple teachers on one module
- i18n (Filipino / English toggle)
- Real XP from games on the leaderboard slice
