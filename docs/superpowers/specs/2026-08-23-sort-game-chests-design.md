# Sort game: chests, Check, tap

**Date:** 2026-08-23  
**Status:** Approved  
**Product:** Jose  
**Supersedes:** the sort row in `docs/superpowers/specs/2026-08-23-game-stage-design.md` (instant miss on a wrong drop). Other game types are unchanged.

## Goal

Sort should look like the rest of Jose, fit every chip in a chest, and grade once per round. A phone tap must select a chip on the first press.

## Locked decisions

- Flat CSS toy chest (gold lid, amber body, keyhole). No face, no sparkle, no SVG illustration.
- Place every chip, then **Check**. No auto-grade on drop.
- Correct chips stay locked. Wrong chips return to **Your chips**. One heart per failed Check.
- Tap a placed unlocked chip to select it. Tap it again to send it home, or tap another chest to move it.
- Below 640px: tap only. At 640px and up: drag still places a chip (still no grade until Check).
- Game JSON unchanged. `onFinish` misses = failed Checks. `firstTryScore(pieceCount, misses)` stays.
- Why text is optional. After a failed Check, one sheet lists bounced chips that have `why`. If none do, skip the sheet and still spend the heart.

## Play

Chests sit above **Your chips**. The tray is fixed to the bottom on a phone (`bottom` above the tab bar) and static on `sm+`. **Check** sits in that tray: disabled until every chip is in a chest, then violet.

Tap a tray chip to select it (violet). Tap a chest to put it there. Tap a selected tray chip again to deselect. Tap an unlocked chip in a chest to select it; tap it again to return it to the tray; tap another chest to move it. Locked chips (green) do not respond.

On a viewport `min-width: 640px`, dragging a chip onto a chest is the same as tap-then-tap. Drag does not Check.

**Check**

1. Every placed chip whose `bucketId` matches stays and locks.
2. Every mismatch returns to **Your chips**.
3. If anything mismatched: `misses += 1`, `onMiss` once, heart spent. Keep playing with the leftovers.
4. If everything matches: `onFinish(score, itemCount, misses)` with `score` ignored by the shell in favor of `firstTryScore`.

A 6-chip sort with one failed Check scores 5/6 and 2 stars. A perfect first Check is 3 stars.

**Why sheet:** title `Not quite` (already on the sheet). Payload title is `Check these again` when two or more bounced chips have why text; if only one has why, the title is that chip's label. Body is `label — why` lines, separated by blank lines. `WhySheet` body uses `whitespace-pre-line`. Chips with empty why bounce with no line on the sheet.

**Hearts:** `onMiss(payload | null)`. Null means spend the heart and do not open a sheet. If that miss empties hearts, go to the break screen immediately when there is no sheet; if there is a sheet, dismiss then break. Practice and playtest call `onMiss` the same way but do not persist hearts.

**Empty tray during a round:** after a partial success, **Check** disables until the bounced chips are placed again.

## Board

Each chest:

1. White label pill with the bucket name (inputs in build mode).
2. Gold lid bar (`#f5c518`) with a small keyhole.
3. Amber body (`#f59e0b` / `#f97316` per column).
4. Cream well that grows with its chips. Empty well: dashed “In here”.

Chips in a chest are full pills, stacked, readable. Two buckets: two columns at every width. Three buckets: one column below 520px, three columns above.

Selected chest (chip armed or drag hover) scales slightly. Failed Check may snap the board once (`snap-back`).

## Gestures (bug)

Today `onPointerDown` selects and `onClick` toggles. A clean tap selects then immediately deselects. A small drag suppresses click, so the select sticks. That is why Chrome's phone tester needs a nudge.

Fix in `use-place-drag.tsx`: pointer down must not call `select`. Click selects. After a successful drop, `consumeClick()` still swallows the leftover click. Timeline keeps this hook; it gets the same tap fix. Sort additionally passes `allowDrag: false` under 640px.

Do not nest a chip `<button>` inside a chest `<button>`. Chest is a `div` with `role="button"` (or a drop target that is not wrapping chip buttons). Chip clicks `stopPropagation`.

## Teacher / practice / copy

Build mode uses the same chest. Chips start in the correct well; label, chip text, and why stay editable. Add chest / add chip unchanged. Playtest uses student rules, local score, no hearts.

Path copy: “Put every chip in a chest, then Check.” Lab `how`: “On a phone, tap a chip and then a chest. On a bigger screen you can drag. Check when every chip is in a chest.” Progress label stays “Chests.”

## Code

- Extract `gradeSortCheck` / `formatSortWhy` in `apps/web/src/components/games/sort-grade.ts` (pure, tested).
- Rewrite play UI in `sort-game.tsx`. Delete `CuteChestSvg`.
- Remove `.toy-chest*` overlay rules from `globals.css`.
- `PlayBoardProps.onMiss` accepts `WhyPayload | null`. `GamePlayer`, lab, and teach playtest skip the sheet on null but path still `POST`s the miss.
- `WhySheet` reads `why.title` and `why.body` (it currently reads `title`/`body`, which are not on the payload).
- No shared schema or API change.

## Tests

- `sort-grade.test.ts`: all placed; mix of right and wrong; perfect Check; why formatting (none / one / many).
- `sort-game.test.tsx`: Check disabled until every chip is placed; failed Check calls `onMiss` once and returns only wrong chips; second Check all-correct calls `onFinish` with `misses === 1`; tap selects a chip (pointerdown + click does not toggle off).
- `use-place-drag.test.tsx`: pointerdown + click leaves the chip selected.
- `game-copy` sort hint mentions Check.

## Out of scope

New game types, changing quiz/memory/timeline/blank scoring, sound, new APIs, committing.

## Success

1. Chests match Jose (cream, gold, rounded type). Every chip label is fully visible.
2. First tap selects. Phone width does not require a drag to arm a chip.
3. Nothing is graded until Check. One failed Check costs one heart.
4. Locked chips stay; leftovers can be re-sorted until all are correct or hearts run out.
5. Teacher build still edits on the same board.
