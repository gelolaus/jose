# Sort Game Chests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the kawaii sort chests with growing CSS chests, grade on Check (one miss per failed round), and make the first tap select a chip.

**Architecture:** Pure `sort-grade.ts` owns Check math and why copy. `sort-game.tsx` owns board state. `use-place-drag.tsx` stops selecting on pointerdown so click can select. `onMiss` may receive `null` when a failed Check has no why text.

**Tech Stack:** Next.js App Router, React 19, Vitest + Testing Library, Tailwind 4, existing `@jose/shared` sort JSON.

## Global Constraints

- Do not commit (human commits later).
- Do not change game JSON or the miss/attempt APIs.
- `firstTryScore(pieceCount, misses)` unchanged; misses = failed Checks.
- Phone = viewport under 640px: sort tap only.
- `WhySheet` must use `why.title` / `why.body`.
- No nested `<button>` inside `<button>`.

---

### Task 1: Sort grade helpers

**Files:**
- Create: `apps/web/src/components/games/sort-grade.ts`
- Test: `apps/web/src/components/games/sort-grade.test.ts`

**Interfaces:**
- Consumes: `SortGame` items (`id`, `label`, `bucketId`, `why?`)
- Produces:
  - `allChipsPlaced(items, placed: Record<string, string>): boolean`
  - `gradeSortCheck(items, placed): { correctIds: string[]; wrongItems: SortGame["items"]; perfect: boolean }`
  - `formatSortWhy(wrongItems): WhyPayload | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { allChipsPlaced, formatSortWhy, gradeSortCheck } from "./sort-grade";

const items = [
  { id: "a", label: "Ibarra", bucketId: "noli", why: "Noli follows Ibarra." },
  { id: "b", label: "Simoun", bucketId: "fili", why: "Sequel." },
  { id: "c", label: "1887", bucketId: "noli" },
];

describe("gradeSortCheck", () => {
  it("is not ready until every chip is placed", () => {
    expect(allChipsPlaced(items, { a: "noli" })).toBe(false);
    expect(allChipsPlaced(items, { a: "noli", b: "fili", c: "fili" })).toBe(true);
  });

  it("locks matches and lists mismatches", () => {
    const result = gradeSortCheck(items, { a: "noli", b: "noli", c: "noli" });
    expect(result.perfect).toBe(false);
    expect(result.correctIds).toEqual(["a", "c"]);
    expect(result.wrongItems.map((i) => i.id)).toEqual(["b"]);
  });

  it("formats why only for chips that have it", () => {
    expect(formatSortWhy([{ id: "c", label: "1887", bucketId: "noli" }])).toBeNull();
    expect(formatSortWhy([items[1]!])).toEqual({
      title: "Simoun",
      body: "Sequel.",
    });
    expect(formatSortWhy([items[0]!, items[1]!])?.title).toBe("Check these again");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @jose/web test src/components/games/sort-grade.test.ts`

Expected: FAIL, cannot resolve `./sort-grade`

- [ ] **Step 3: Write `sort-grade.ts`**

Implement the three functions. `formatSortWhy`: no non-empty why → `null`; one → `{ title: label, body: why }`; many → `{ title: "Check these again", body: lines of "label — why" joined by `\n\n` }`.

- [ ] **Step 4: Re-run until PASS**

- [ ] **Step 5: Do not commit**

---

### Task 2: Tap no longer toggles off

**Files:**
- Modify: `apps/web/src/components/games/use-place-drag.tsx`
- Test: `apps/web/src/components/games/use-place-drag.test.tsx`

**Interfaces:**
- Consumes: existing hook
- Produces: same hook; `onPointerDown` does **not** call `select`. Add optional `allowDrag` (default `true`). When `allowDrag` is false, pointer handlers no-op (click still used by the caller).

- [ ] **Step 1: Write a probe test** that pointerdown + click leaves the chip selected (`textContent === "on"`).

- [ ] **Step 2: Run it — expect FAIL** (`"off"` because pointerdown selects and click toggles).

- [ ] **Step 3: Remove `select(itemId)` from `onPointerDown`. Honor `allowDrag === false`.**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Do not commit**

---

### Task 3: Sort play board

**Files:**
- Modify: `apps/web/src/components/games/sort-game.tsx`
- Modify: `apps/web/src/app/globals.css` (delete `.toy-chest*` rules)
- Modify: `apps/web/src/components/games/play-types.ts` (`onMiss` allows `null`)
- Modify: `apps/web/src/components/game-player.tsx`, `game-lab.tsx`, `teach-game-editor.tsx` (null why skips sheet)
- Modify: `apps/web/src/components/games/game-stage.tsx` (`why.title` / `why.body`, `whitespace-pre-line`)
- Test: `apps/web/src/components/games/sort-game.test.tsx`

**Interfaces:**
- Consumes: `gradeSortCheck`, `allChipsPlaced`, `formatSortWhy`, `usePlaceDrag({ allowDrag })`
- Produces: play loop described in the spec; CSS `SortChest` (lid, body, growing well)

- [ ] **Step 1: Write failing tests**

  - Check disabled until all chips placed
  - Place all, Check with one wrong: `onMiss` once, wrong chip back in **Your chips**, correct chip still in chest
  - Place leftover correctly, Check: `onFinish` called with `misses === 1`

- [ ] **Step 2: Run — FAIL** (Check does not exist)

- [ ] **Step 3: Implement SortPlay + SortChest.** Viewport `matchMedia("(min-width: 640px)")` gates `allowDrag`. Nested buttons forbidden.

- [ ] **Step 4: PASS** `sort-game.test.tsx` and `sort-grade.test.ts`

- [ ] **Step 5: Do not commit**

---

### Task 4: Copy + spec note

**Files:**
- Modify: `apps/web/src/lib/game-copy.ts`, `apps/web/src/lib/lab-games.ts`
- Test: `apps/web/src/lib/game-copy.test.ts` (create if missing)
- Modify: `docs/superpowers/specs/2026-08-23-game-stage-design.md` sort row → Check round

- [ ] Hint: `Put every chip in a chest, then Check.`
- [ ] Lab how: phone tap-then-chest, desktop drag, Check when every chip is in.
- [ ] Run `@jose/web` tests. Do not commit.

---

### Task 5: Verify in the browser

- Open `/practice/sort` at a phone width (~390px) and a desktop width.
- Confirm first tap highlights a chip, chests grow, Check grades once, leftover returns, locked chips stay green.
- Path play: one failed Check drops one heart.

---

## Self-review

1. Spec coverage: grade math, chest look, tap bug, Check, hearts/null why, teacher board, copy, WhySheet field names, 2- vs 3-bucket layout — all tasked.
2. No TBD placeholders.
3. Names: `gradeSortCheck`, `formatSortWhy`, `allowDrag` used consistently.
