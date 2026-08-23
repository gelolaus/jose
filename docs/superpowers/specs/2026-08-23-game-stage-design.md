# Jose — Game stage (playable boards)

**Date:** 2026-08-23  
**Status:** Approved for implementation  
**Product:** Jose — kids-first gamified path for *The Work and Life of Rizal*  
**Companion:** `docs/superpowers/specs/2026-08-15-rizal-modules-lessons-games-design.md`

## Goal

The five teacher-authored game types stay. They must **play as games**, not worksheets: a visible metaphor, tap-first interaction, instant feedback, and a short **why** on a miss. Teachers build on the **same board** students play. Hearts make a tired student take a break instead of rushing.

## Locked decisions

| Choice | Decision |
| --- | --- |
| Approach | One **Game Stage** shell + five unique boards. Not five mini-apps. Not a mixed Duolingo lesson. |
| Types | Still `quiz`, `memory`, `timeline`, `blank`, `sort`. No new types. |
| Devices | Phone must be great. Desktop is a wider stage. Same rules and gestures. |
| Authoring | **Build mode is the board.** Teachers place pieces on the toy, then Playtest. |
| Miss | Instant “not quite”, right fact stays on screen, optional teacher **why**. Then continue. |
| Clock | None. Stars come from accuracy (misses), not speed. |
| Hearts | Path hearts (max 5). A miss spends one immediately (server). At 0 you cannot **start** a game. Lessons stay open. |
| Refill | 1 heart / 15 minutes while below 5, **and** completing a lesson sets hearts to 5. |
| Unlock | Finishing a round still unlocks the next node, even with misses. Hearts only gate **starting** a game. Running out mid-round does **not** complete the level. |
| Seed | Featured path: each section gets a real game. Ateneo days is the showcase of all five types. |

## Non-goals

- New game types, accounts, pass marks, sound packs, file upload, leaderboards.

## Architecture

```
Play Stage / Build Stage     (same boards)
        │
   apps/web
        │  REST + Zod
        ▼
   Nest: curriculum + hearts
        │
   learners.hearts + hearts_updated_at
   game_content.json  (type + pieces + optional why)
   attempts           (score, stars, misses in payload)
```

Hearts are server truth. A miss `POST`s immediately so refresh cannot undo it. Opening a game at 0 hearts returns `403` with `code: HEARTS_EMPTY` (friendly break screen, not a silent redirect). Completing a lesson (including Continue on an already-finished lesson) sets hearts to 5.

## Domain

### Hearts

- `learners.hearts` (0–5), `learners.hearts_updated_at` (ms).
- On every learner read: apply drip `floor((now - updatedAt) / 15min)`, cap 5, keep remainder by advancing `updatedAt` by `gained * interval`.
- Spend: decrement; if leaving 5, set `updatedAt = now` (start the drip). Do not reset the timer when spending from 4→3.
- Lesson `POST /complete`: mark progress, then `hearts = 5`.
- Chests and game finishes do not refill.

### Game JSON

Discriminated union, still one row per level. Each scorable piece may include `why` (max 280 chars, optional).

- **quiz** — `questions[]`: prompt, choices, correctIndex, why
- **memory** — `pairs[]`: sides a/b, why (shown on a successful match; mismatches still spend a heart)
- **timeline** — `items[]`: `{ id, label, year?, why }` in correct order. Legacy `string[]` items are coerced on read.
- **blank** — `items[]`: sentence with `___`, answer, decoys, why
- **sort** — buckets (2–3), items with `bucketId`, why per item

### Scoring

- `maxScore` = number of pieces (questions / pairs / timeline items / blanks / sort items).
- `score` = pieces that never took a miss.
- `stars`: 3 if misses = 0; 2 if misses ≤ `max(1, ceil(pieces * 0.25))`; 1 if they finish with more misses.
- Attempt payload: `{ misses, stars }`.

## Student UX

### Shared stage

HUD: title, hearts, piece progress. Cream page, gold/violet toys, Fredoka titles. Miss opens a **why sheet** (cannot skip instantly). Finish is a star celebration (Retry / Continue). Out of hearts: “Take a break — read a lesson or wait.”

### Boards (play)

| Type | Board | Interaction |
| --- | --- | --- |
| timeline | Vertical history rail (oldest at top), year ticks, empty stations, event cards in a tray | Drag a card onto a station, or tap a card then tap a station. Wrong station: snap back, why, heart. |
| memory | Felt table, thick flip cards | Flip two. Mismatch: flip back, heart. Match: stay lit, show why. |
| sort | 2–3 labeled chests + chip tray | Drag a chip onto a chest, or tap chip then tap chest. Wrong chest: bounce back, why, heart. |
| quiz | Spotlight prompt + big 3D answer buttons | Tap. Wrong: why + correct stays marked, then next. |
| blank | One parchment sentence at a time, hole for the missing word, chip bank | Tap a chip. Wrong: why + correct revealed, that sentence is spent, next. |

Wrong quiz/blank answers are locked as misses (no re-earn). Timeline/sort/memory let you keep placing/flipping the remaining pieces until done or hearts run out.

### Featured seed

| Section | Game |
| --- | --- |
| Childhood | Timeline of early life |
| Education | Quiz (schools) |
| Travels | Memory (places and work) |
| Noli & Fili | Sort (Noli vs Fili) |
| Martyrdom | Blank (trial, poem, Bagumbayan) |

Insert each game **before** that section’s chest when a chest exists, otherwise at the end of the section.

### Ateneo days

Lesson, then quiz, memory, timeline, blank, sort — one of each type.

## Teacher UX

Same boards in **Build**. Tap a piece to edit its text / year / why / correct answer. Add/remove pieces on the board. **Playtest** runs the student game locally (no hearts, no attempt). **Save game** writes `PUT /teach/levels/:id/game`.

## API

Student:

- `GET /levels/:id` — includes `learner` (after drip). Game + 0 hearts → 403 `HEARTS_EMPTY`.
- `POST /levels/:id/miss` — spend one heart; 403 `HEARTS_EMPTY` if none left. Returns `{ learner }`.
- `POST /levels/:id/complete` — lessons/chests; lessons refill hearts to 5.
- `POST /levels/:id/attempts` — unchanged complete-on-finish; still forbidden at 0 hearts.

## Error handling

- Hearts empty: break screen with Path + Modules, never a silent redirect.
- Miss when already 0: 403, board stops.
- API down: existing napping state.
- Legacy timeline `string[]`: coerce, do not crash.

## Testing

- **shared:** drip math; stars; timeline coerce; why optional; empty templates still parse.
- **api:** miss spends a heart; 0 hearts blocks `GET` game; lesson complete refills; Ateneo still sequential.
- **web:** locked node still shakes (existing). Smoke: stage renders a title.

## Success criteria

1. Timeline looks like a timeline (rail + stations + years), not a list of up/down boxes.
2. A miss shows a why sheet and the top-bar/HUD heart count drops after the API returns.
3. At 0 hearts, a game will not start; a lesson will, and Continue fills hearts.
4. Teacher studio edits the timeline on the rail and Playtest plays that board.
5. Featured path shows a game in every section; Ateneo days has all five types.
6. Phone-width play uses tap-to-place; desktop can drag onto the same stations. Both gestures work.
7. Practice (`/practice`) is a Game Lab: all five types, local scores, no hearts.
