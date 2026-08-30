# Jose Quality and Resilience Design

**Date:** 2026-08-30
**Status:** Approved through the user's standing instruction to proceed without review pauses

## Goal

Make the current Jose experience safer to change and more dependable without adding accounts, changing curriculum rules, or redesigning the product.

## Audit baseline

- `npm test` passes 72 tests across shared, API, and web packages.
- `npm run build` succeeds for all three workspaces.
- `npm run lint` fails with 10 React errors and one warning.
- `npm audit --omit=dev --audit-level=high` reports four high-severity advisories through the installed Next.js dependency tree.
- Desktop and 390 by 844 pixel browser checks show a coherent module grid and practice hub with no console warnings or errors.

## Scope

### Restore the quality gate

Remove render-time ref writes and synchronous effect resets from the game and profile components. Keep the current gameplay rules and visual design. State that belongs to a fresh play session should be initialized when the play component mounts; callback refs should update after commit.

### Preserve error meaning

Teacher detail pages should call `notFound()` only for an API 404. Connection errors and server failures should reach a teacher-specific error boundary with a retry control. JSX should be constructed outside `try` blocks so React rendering failures are not confused with fetch failures.

### Improve accessible interaction

The “why” sheet and timeout sheet are modal dialogs. They should expose dialog semantics, announce their headings, take focus when opened, close from Escape where dismissal is allowed, and restore a clear focus target through normal application flow. Status and error messages should use live-region semantics where feedback arrives after interaction.

Animation should respect `prefers-reduced-motion`. Interactive elements should have visible keyboard focus across shared navigation, cards, and primary controls.

### Patch dependencies

Update Next.js and its ESLint configuration from 16.2.12 to 16.3.3, and Turbo from 2.10.11 to 2.10.12. These are patch updates within the existing major versions. Re-run the production dependency audit after installation.

## Boundaries

- Do not add authentication, accounts, pass marks, cloud persistence, monitoring, or new games.
- Do not change the demo learner model or restore data that a user may have edited in the local SQLite file.
- Do not alter score or unlock rules established by the existing product spec.
- Do not stage, commit, push, deploy, or open a pull request.

## Testing

- Add focused tests for error classification and dialog behavior where practical.
- Run web tests while changing React state behavior.
- Run `npm test`, `npm run lint`, `npm run build`, and the production dependency audit at the end.
- Recheck the learning home, practice flow, teacher error boundary, and a representative game in the browser at desktop and phone widths.

## Success criteria

1. The full lint command exits successfully with no warnings.
2. Existing tests remain green and new regression tests cover changed behavior.
3. Production build succeeds on Next.js 16.3.3.
4. Production dependency audit reports no high-severity findings.
5. Teacher 404s and API failures show different outcomes.
6. Modal feedback works with keyboard focus, Escape, and reduced-motion settings.
