# Timeline Gold Rail Implementation Plan

> **For agentic workers:** Executing in this session. Do not commit (user commits later).

**Goal:** Rebuild Timeline so it mirrors Sort: gold rail toy, place every event, then Check.

**Architecture:** Pure `timeline-grade.ts` owns Check math and why copy. `timeline-game.tsx` owns board state. Reuse `usePlaceDrag`. Optional wider `GameFrame` for timeline only.

**Tech Stack:** Next.js App Router, React 19, Vitest + Testing Library, Tailwind 4, existing `@jose/shared` timeline JSON.

## Global Constraints

- Do not commit.
- Do not change game JSON or miss/attempt APIs.
- `firstTryScore(pieceCount, misses)` unchanged; misses = failed Checks.
- Phone = viewport under 640px: tap only.
- Why payload is `{ title, body }`.
- No nested `<button>` inside `<button>`.
- Year string max 40; pills wrap; chips never show year.

## Files

- Create: `apps/web/src/components/games/timeline-grade.ts`
- Create: `apps/web/src/components/games/timeline-grade.test.ts`
- Create: `apps/web/src/components/games/timeline-game.test.tsx`
- Modify: `apps/web/src/components/games/timeline-game.tsx`
- Modify: `apps/web/src/lib/game-copy.ts`
- Modify: `apps/web/src/lib/game-copy.test.ts`
- Modify: `apps/web/src/lib/lab-games.ts`
- Modify: `apps/web/src/components/games/game-stage.tsx` (`GameFrame` wide)
- Modify: `apps/web/src/components/game-player.tsx`
- Modify: `apps/web/src/components/game-lab.tsx`

### Task 1: Grade helpers (TDD)

- [ ] Failing tests in `timeline-grade.test.ts`
- [ ] Implement `allStopsFilled`, `gradeTimelineCheck`, `formatTimelineWhy`
- [ ] Tests pass

### Task 2: Play board + copy (TDD)

- [ ] Failing `timeline-game.test.tsx` and copy test
- [ ] Rewrite `timeline-game.tsx` play + build
- [ ] Wire copy, lab how, wider frame
- [ ] Tests pass

### Task 3: Browser check

- [ ] Lab Timeline on a narrow and a wide viewport: tap-to-place, Check, bounce, lock, wrap a full date
