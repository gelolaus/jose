# Jose Quality and Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the repository quality gate and improve failure handling and accessible interaction without changing Jose's product rules.

**Architecture:** Keep the existing Next.js, NestJS, and shared-package boundaries. Fix state ownership inside existing components, centralize API error classification in the web data layer, and add a route-level teacher error boundary.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, NestJS, Turbo

**Spec:** `docs/superpowers/specs/2026-08-30-quality-resilience-design.md`

## Global Constraints

- No authentication, account, curriculum, scoring, or unlock changes.
- Preserve the local SQLite file and all unrelated work.
- Do not stage, commit, push, deploy, or create a pull request; the user commits manually.
- Use the bundled Next.js 16 documentation before changing App Router behavior.

---

### Task 1: React state and ref correctness

**Files:**
- Modify: `apps/web/src/components/games/blank-game.tsx`
- Modify: `apps/web/src/components/games/game-stage.tsx`
- Modify: `apps/web/src/components/games/memory-game.tsx`
- Modify: `apps/web/src/components/games/timeline-game.tsx`
- Modify: `apps/web/src/components/games/use-place-drag.tsx`
- Modify: `apps/web/src/components/profile-edit-form.tsx`
- Modify: `apps/web/src/components/profile-showcase.tsx`
- Create: `apps/web/src/lib/use-explorer-identity.ts`
- Test: `apps/web/src/components/games/game-hydration.test.tsx`

**Interfaces:**
- Consumes: existing `PlayBoardProps`, `ExplorerIdentity`, and game content types
- Produces: the same public component props with lint-clean internal state handling

- [x] Run the web lint command and retain the exact failing-rule list.
- [x] Replace play-session effect resets with deterministic server state and post-hydration session setup.
- [x] Add server-render regression coverage for the three shuffled game types.
- [x] Update callback refs after commit instead of during render.
- [x] Replace profile mount effects with a hydration-safe external store.
- [x] Run `npm test --workspace=@jose/web` and `npm run lint --workspace=@jose/web`.

### Task 2: Teacher error classification

**Files:**
- Modify: `apps/web/src/lib/path-api.ts`
- Modify: `apps/web/src/app/teach/modules/[moduleId]/page.tsx`
- Modify: `apps/web/src/app/teach/modules/[moduleId]/levels/[levelId]/page.tsx`
- Create: `apps/web/src/app/teach/error.tsx`
- Test: `apps/web/src/lib/path-api.test.ts`

**Interfaces:**
- Consumes: `ApiError.status` from the existing fetch layer
- Produces: `isNotFoundError(error: unknown): boolean` for route code

- [x] Add a failing unit test that accepts only `ApiError` status 404 as not found.
- [x] Export the minimal classifier from `path-api.ts`.
- [x] Fetch inside `try`, call `notFound()` only for classified 404 errors, and construct JSX after the `try` block.
- [x] Add a client error boundary with an accessible message and `reset()` button.
- [x] Run the focused test and web lint.

### Task 3: Accessible feedback and motion

**Files:**
- Modify: `apps/web/src/components/games/game-stage.tsx`
- Modify: `apps/web/src/components/games/memory-game.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: shared navigation and card components only where the audit finds missing focus indication
- Test: `apps/web/src/components/games/game-stage.test.tsx`

**Interfaces:**
- Consumes: existing `WhyPayload`, dismiss callbacks, and timeout state
- Produces: modal dialogs with `role=dialog`, `aria-modal`, labelled headings, focus on open, and Escape dismissal where safe

- [x] Write failing tests for dialog labelling, initial focus, and Escape dismissal.
- [x] Implement dialog refs and keyboard handling without changing the delay before “Got it” becomes active.
- [x] Mark asynchronous errors and results as live regions.
- [x] Add `:focus-visible` defaults and a reduced-motion media query that disables decorative animation and transitions.
- [x] Run focused tests, all web tests, and web lint.

### Task 4: Patch-level dependency remediation

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: current Next.js 16 and Turbo 2 APIs
- Produces: Next.js 16.3.3, eslint-config-next 16.3.3, and Turbo 2.10.12 lockfile resolution

- [x] Install the three exact patch versions with npm workspaces intact.
- [x] Run `npm audit --omit=dev --audit-level=high` and require a successful exit.
- [x] Run the full test, lint, and build commands.

### Task 5: Browser and diff verification

**Files:**
- Inspect: all changed and untracked files

**Interfaces:**
- Consumes: the completed implementation
- Produces: verified browser behavior and a reviewed manual commit message

- [x] Reload the local application after changes.
- [x] Check desktop and 390 by 844 pixel layouts for learning and practice.
- [x] Exercise one representative game dialog with keyboard interaction.
- [x] Confirm the teacher error boundary and 404 handling through focused local checks.
- [x] Run `git status --short`, `git diff --stat`, `git diff`, and inspect every untracked file.
- [x] Draft one Conventional Commit subject and body without staging or committing.
