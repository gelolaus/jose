# Timeline game: gold rail, Check, tap

**Date:** 2026-08-23  
**Status:** Approved  
**Product:** Jose  
**Supersedes:** the timeline row in `docs/superpowers/specs/2026-08-23-game-stage-design.md` (instant miss on a wrong drop). Other game types are unchanged.

## Goal

Timeline should look like a Jose toy, grade once per round like Sort, and work as one board on a phone, a tablet, and a desktop. Years and full dates live on the stops. Event chips never show the date.

## Locked decisions

- Place every event, then **Check**. No auto-grade on drop.
- Correct cards lock. Wrong cards bounce to **Events**. One heart per failed Check.
- Year field stays a string (max 40). It may be `1861`, `1860s`, `Story`, or `June 19, 1861`. The gold pill wraps. We do not truncate. Empty year shows `Stop N`.
- Event chips show `label` only.
- Phone (under 640px): stacked gold rail, tap only, Events + Check stick above the tab bar (same `5.2rem + safe-area` as Sort).
- From 640px: horizontal hanging cards, oldest on the left, drag and tap, tray static, Check on the right of the tray. Extra stops scroll sideways with the next card peeking.
- Same gold toy at every width: 3D gold track, numbered beads, wrapping date pill, stem, hanging card.
- Unlocked placed cards can be picked up (tap again to return, or move to an empty stop). Locked cards do not move.
- Build edits on the rail. Playtest uses student rules, local score, no hearts.
- Game JSON and APIs unchanged. `onFinish` misses = failed Checks. `firstTryScore(eventCount, misses)` stays.
- Approach: mirror Sort inside Timeline. No shared place-and-check kit.

## Play

The rail is teacher order, oldest first. You fill every stop, then Check. Check stays disabled while any stop is empty.

**Check**

1. Every event on its matching stop stays and locks.
2. Every mismatch returns to **Events**.
3. If anything mismatched: `misses += 1`, `onMiss` once. Keep playing with leftovers. Check disables until those events are placed again.
4. If everything matches: `onFinish(score, itemCount, misses)` with `score` ignored by the shell in favor of `firstTryScore`.

A 4-event timeline with one failed Check scores 3/4 and 2 stars.

**Why sheet:** sheet chrome title stays `Not quite`. Payload: no why on bounced events → `null` (heart still spends, no sheet); one why → `{ title: label, body: why }`; several → `{ title: "Check these again", body: "label — why" }` lines separated by blank lines.

**Hearts:** `onMiss(payload | null)` same as Sort.

**Gestures:** pointer down does not select. Click selects. After a drag-drop, `consumeClick()` swallows the leftover click. Below 640px `allowDrag: false`. Do not nest a card `<button>` inside a stop `<button>`.

## Board

Each stop: gold date pill (wraps), numbered bead on the gold track, short stem, hanging card. Empty card is dashed. Targeted card gets a gold ring. Filled card is cream. Locked card is green.

The play frame may use `max-w-5xl` for timeline so four cards can show.

## Teacher

Same rail. Date pill, hanging card, and why are inputs on the board. Move earlier/later, remove (min 2), add event (max 12). Playtest is student play.

## Code

- `apps/web/src/components/games/timeline-grade.ts`: `allStopsFilled`, `gradeTimelineCheck`, `formatTimelineWhy` (pure, tested).
- Rewrite `timeline-game.tsx`. Reuse `usePlaceDrag`. Copy Sort’s `useWideScreen` (640px).
- `game-copy.ts` + lab `how`.
- `GameFrame` optional wider max for timeline.
- No shared schema or API change.

## Tests

- Grade: not ready until full; mix of right and wrong; perfect; why none / one / many (including a full date on a stop).
- Play: Check disabled until every stop is filled; failed Check calls `onMiss` once and returns only wrong events; second Check all-correct calls `onFinish` with `misses === 1`; pointerdown + click leaves an event selected.
- `hintFor("timeline")` mentions Check.

## Out of scope

New game types, changing quiz/memory/sort/blank, sound, new APIs, committing.

## Success

1. Phone and desktop are the same gold toy, stacked vs sideways.
2. First tap selects. Dates never appear on event chips.
3. Nothing is graded until Check. One failed Check costs one heart.
4. Locked cards stay; leftovers can be re-placed until all are correct or hearts run out.
5. Teacher build edits on the rail.
