# Jose application audit and Cursor handoff

**Reviewed:** 9 September 2026  
**Scope:** current working tree at commit `98d6b1e`; source and automated-test review. No production environment, Turso database, or Microsoft Entra tenant was changed.

## Bottom line

Jose already has the correct broad shape: Next.js web app, NestJS API, shared Zod contracts, libSQL migrations, sessions, roles, content revisions, server-graded assessment attempts, teacher-owned classes, and multiple assignments per class. Do not replace that foundation.

The next release should focus on four connected jobs:

1. Make student identity immutable and remove all local-test role switching.
2. Turn the existing per-assignment report into a class gradebook with a separate exportable table for every assigned module.
3. Add a validated full-module import format. It must be previewed before it writes content.
4. Remove seed content and prepare an empty, deployable database without deleting migration history or student records by accident.

Do these in small batches. The gradebook, import format, and reset process change data contracts and need migration plus HTTP-level regression tests.

## Confirmed findings

| Priority | Finding | Evidence in the current code | Required fix |
| --- | --- | --- | --- |
| P0 | A signed-in student can change their displayed name. | `PATCH /auth/profile` accepts `displayName`; `UsersService.updateDisplayName` writes it; the profile form renders a name input. | Do not accept or write a student name from self-service profile editing. The API must reject it, not merely hide the input. |
| P0 | The local Arlaus sign-in and role switch still exist. | `LocalDevPanel`, `/auth/dev/login`, and `/auth/dev/role`; the panel is mounted in `TeachShell`. | Remove the UI, local endpoints, local role mutation, and their test-only configuration paths. Replace the account with a normal persisted admin role. |
| P0 | Teachers can assign more than one module, but the UI shows the report for only the latest assignment. | `createAssignment` inserts unlimited assignment rows. `TeachClassesClient` loads `assignments.at(-1)` and one report. | Show every active and historical assignment in a class. Render one grade table per assignment/module and export each table. |
| P0 | Class reports expose names but not email addresses, and old assignment data becomes hard to reach. | `ClassMemberProgress` has no email. CSV omits email. `listClassAssignments` filters archived assignments. | Add admission email to teacher-only rows and exports. Preserve, list, and open historical assignments and their recorded attempts. |
| P0 | There is no full module import. | There is only `POST /teach/levels/:id/import-questions`; lessons and games are edited one level at a time. | Add a dry-run importer for module metadata, sections, lessons, lesson blocks, and all supported game types. |
| P1 | The Outline control is mobile-only and only replaces the editor pane. Desktop always has the outline open. | `TeachModuleWorkspace` renders the button only below `lg`; `setPane("outline")` changes the selected pane. | Rename it to `Back to outline` on mobile and make it visibly return to the outline. Do not show it as a no-op on desktop. |
| P1 | Teacher navigation contains student destinations; student profile contains a teacher destination. | `TeachShell` has Modules, Classes, Learn, Profile. `ProfileShowcase` renders Teacher area. | Teacher shell should contain Modules and Classes only, with a bottom navigation area for Learn and Teacher area context. Student profile must not render Teacher area. |
| P1 | Seed tooling remains, although startup no longer reseeds. | `db:seed`, `seed.ts`, `seed-cli.ts`, `seedHistory`, and seed documentation remain. `DatabaseService` now runs migrations only. | Remove curriculum/demo seed tooling and create an explicit guarded empty-database workflow. Keep migrations, backups, and restore. |
| P1 | Turso support is prepared but not proven against a deployed environment. | `JOSE_DATABASE_URL`, `JOSE_DATABASE_AUTH_TOKEN`, production migration checks, CORS validation, and Next `/api` rewrite already exist. | Add deployment templates and a staging checklist; do not rewrite the database layer. |
| P1 | The web lint gate currently fails. | `npm run lint` reports `react-hooks/set-state-in-effect` at `apps/web/src/components/teach-level-editor.tsx:68`, where an effect synchronously calls `setError` and `setConflict`. | Restructure error/conflict reset so it is caused by the edit action or by a keyed child remount, not a synchronous state update inside the effect. Keep the editor's save/conflict behavior covered by its existing tests. |

## Required product rules

### Identity and access

- A student's legal/display name is copied from the admitted account at first account creation. Students cannot edit it in the browser or API.
- The profile page may still let a student change only their avatar and reading preferences.
- A correction to a name requires an administrator support action. It must be audited. Do not allow a teacher to edit it casually.
- `arlaus@student.apc.edu.ph` must have the persisted `admin` role. In this application `admin` already passes teacher authorization, so it is both an administrator and a teacher in capability terms. Do not introduce a second role field and do not hard-code an email check into request authorization.
- Use an idempotent, server-only one-time command to promote that exact existing account to `admin`, with an audit row. It must fail if the account has never completed normal sign-in. After it runs, remove the command's bootstrap secret/environment value. An admin role remains in the database until an authorized administrator changes it.
- Delete the local test account shortcuts rather than relabeling them. No `/auth/dev/login`, `/auth/dev/role`, local role switch, or `LocalDevPanel` should remain in the production code path.

### Gradebook

An **assignment** is the immutable pairing of one class, one module, and one published module revision. A class can have many assignments, including repeated assignments of the same module at different revisions. Never overwrite or merge their results.

For a teacher who owns the class, the gradebook must show every current and archived assignment. Each assignment gets its own table. A table contains one row per current or former class member:

| Student name | APC email | Membership | Progress | Completed levels | Best assessed score | Latest assessed score | Latest attempt time | Assigned revision | Assignment state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

- `Membership` must state active or left/archived; retain former members so historical grades do not disappear.
- Scores are assessment attempts only. Practice attempts must not appear as course grades.
- `Best assessed score` and `Latest assessed score` must state the numerator and denominator, for example `8 / 10 (80%)`.
- Scores and progress must be derived from attempts and completions tied to the assignment's `contentRevisionId`, not from the module's current draft.
- The normal view shows each assignment separately. A later summary view may compare assignments, but it must not mix revision data into one grade.
- The class member list is a teacher-only roster and includes name, APC email, joined date, and membership state. It must not be reachable by another teacher or student.
- Provide `Download CSV` for each assignment table. It must include the visible fields, ISO-8601 timestamps, assignment/revision identifiers, and formula-safe cells. Keep the existing CSV injection protection.
- Pagination belongs in the API now, even if the first UI page is small. Use a stable cursor or page/limit contract and a maximum export size that streams or is explicitly bounded.

### Full module import

Use a versioned fenced text format named **Jose Module Markup (JMM) v1**. It is not raw Markdown alone; Markdown is used inside explicitly marked text fields. This avoids guessing whether a heading is a section or a lesson.

The importer has two steps:

1. **Validate and preview**: parse text, validate with the same shared Zod schemas used by the editors, show a tree and every error with source line/column. This step never writes to the database.
2. **Create draft**: when the teacher confirms, create one new draft module and all child records in one database transaction. Do not modify an existing module in v1. Teachers can review, preview, and publish normally afterwards.

Required envelope and examples:

````text
<<<JoseModule version="1">>>
title: The Propaganda Movement
subtitle: Ideas, writings, and reform
coverColor: #22C55E
objectives:
  - Explain why the movement formed.
  - Connect a source to its historical context.

<<<Section>>>
title: Origins
subtitle: Context before 1882
themeColor: #38BDF8

<<<Lesson>>>
title: Why reform mattered

<<<Text markdown>>>
## A movement across borders

Write ordinary CommonMark/GFM here. Do not use raw HTML, iframe, script,
or unsafe URL schemes.
<<<Text/>>>

<<<Image>>>
src: https://example.edu/image.jpg
alt: Students reading a nineteenth-century newspaper
attribution: Library collection, public domain
<<<Image/>>>

<<<Quote>>>
text: Education is the foundation of society.
source: Jose Rizal
citation: Exact source and page or stable URL
<<<Quote/>>>

<<<Glossary>>>
- term: Propaganda Movement
  definition: A reform movement led by Filipino expatriates.
<<<Glossary/>>>

<<<Video>>>
youtubeUrl: https://www.youtube.com/watch?v=abcdefghijk
title: Lecture excerpt
transcript: A full text alternative goes here.
<<<Video/>>>

<<<Checkpoint>>>
prompt: Which condition made overseas publication useful?
answerHint: Think about colonial censorship.
<<<Checkpoint/>>>
<<<Lesson/>>>

<<<Game type="quiz">>>
title: Check the evidence
{
  "type": "quiz",
  "questions": [
    {
      "id": "q1",
      "prompt": "Which source best supports the claim?",
      "choices": [
        { "id": "a", "text": "A dated letter", "correct": true },
        { "id": "b", "text": "An unsourced post", "correct": false }
      ],
      "explanation": "The letter has author and date information."
    }
  ]
}
<<<Game/>>>
<<<Section/>>>
<<<JoseModule/>>>
````

JMM v1 rules:

- Tags are case-sensitive and must close in LIFO order. Unknown tags are errors.
- Valid top-level structure is one `JoseModule`, one or more `Section` blocks, and one or more `Lesson` or `Game` blocks in each section.
- `Text` uses Markdown. The application must continue sanitizing rendered Markdown. Do not permit raw HTML to bypass the existing sanitizer.
- `Image`, `Quote`, `Glossary`, `Video`, and `Checkpoint` map directly to the existing lesson-block schema. An image needs `src` and `alt`; quote needs `text` and `source`; video needs a valid YouTube URL/id and transcript; glossary needs one or more term/definition pairs.
- A `Game` body is strict JSON matching the existing shared `gameContentSchema`. `type` must be one of the supported game types. The tag's `type` attribute must equal the JSON `type`.
- Assign stable import-local IDs only inside the import parser. Do not accept caller-supplied database IDs or owner IDs.
- Limit import bytes, section count, level count, per-block text, image count, and game payload size using shared limits. Reject duplicate titles only where the editor would reject them.
- Store the original source text and JMM version in import audit metadata. This makes a broken import reproducible without treating the text as executable content.
- Ship `docs/authoring/jose-module-markup-v1.md` containing the grammar, complete examples for every game type, error examples, and a ready-to-copy prompt for other LLMs. The prompt must require source citations, accessible image alt text, video transcripts, and valid JSON. It must tell the LLM never to invent citations or use raw HTML.

## Delivery sequence for Cursor

### Batch 1: identity and navigation

1. Change `profilePatchBodySchema` so self-service profile updates accept `avatarId` only. Make an attempted `displayName` a clear 400/403 API error.
2. Remove the name input and name-save branch from the profile editor. Display the account name and APC email as read-only.
3. Add an admin-only audited name-correction operation if operations need it. It must be separate from self-service profile editing.
4. Add an idempotent server-only promotion command for `arlaus@student.apc.edu.ph`. Its result must be an existing persisted `admin` role, not a request-time exception. Test that an admin enters `/teach` successfully.
5. Remove `LocalDevPanel`, `loginAsArlaus`, `switchLocalDevRole`, `/auth/dev/login`, `/auth/dev/role`, the local test role method, their environment flags, and tests that assert their presence. Keep normal mock Microsoft sign-in only if it remains useful for isolated automated tests; it must not create a role-changing UI.
6. Teacher shell: place Modules and Classes in the main area. Put Learn at the bottom as the exit to student learning. Remove Profile from teacher shell. Student profile: remove Teacher area. Update desktop and mobile tests.
7. Rename the mobile `Outline` button to `Back to outline`; add an accessible visible indicator of the selected lesson after returning. Keep the desktop outline fixed. Test the mobile pane transition.
8. Fix the existing `teach-level-editor.tsx` lint failure without suppressing the React rule. A clean `npm run lint` is a required completion check for every later batch.

### Batch 2: gradebook and exports

1. Add shared schemas for gradebook list, assignment table, roster row, attempt summary, export options, and pagination.
2. Add a teacher-authorized gradebook endpoint that returns every assignment, including archived assignments, for one owned class. Add a separate teacher-authorized roster endpoint if that produces simpler pagination.
3. Extend report rows with `admissionEmail`, membership state, latest score, best score, latest attempt timestamp, and assignment revision metadata. Preserve historical attempt records. Never return these fields from student endpoints.
4. Replace per-member query loops with joined/batched queries. Add indexes after inspecting the query plan for `assignments(class_id, archived_at)`, `class_members(class_id, archived_at)`, and attempt lookup by learner/revision/time.
5. Update Classes UI to render an assignment navigation list plus one clearly labelled table per assignment. It must not default silently to only the latest assignment.
6. Add a CSV endpoint and download action per assignment. Include email and all table fields. Protect against formula injection and assert that `=`, `+`, `-`, `@`, tabs, and carriage returns are guarded.
7. HTTP tests: teacher gets their class's roster and every assignment; another teacher and a student get 403; historical member/archived assignment remains reportable; duplicate module assignments do not merge; practice attempts are excluded; CSV contains headers and safe values.

### Batch 3: JMM import and authoring guide

1. Build parser, source-location error type, and Zod-backed validator in `packages/shared`. Test all tags, nesting, malformed closing tags, unsupported game type, bad JSON, unsafe markup, oversized input, and missing accessibility fields.
2. Add API preview and commit endpoints. Preview has no database writes. Commit creates a fresh owned draft module in a single transaction and writes a content audit record with JMM version and source hash.
3. Build a teacher import page/dialog with paste area, validation list, read-only outline preview, create-draft confirmation, and link to the guide. Do not add live autosave during paste.
4. Write the authoring guide and an LLM prompt template. Include every current game format from the shared schemas, not guessed examples.
5. End-to-end test: a valid imported module appears as draft, previews correctly, and can be published after normal readiness checks. A failed import leaves no module/section/level rows.

### Batch 4: empty start and deployment readiness

1. Delete demo/curriculum seed commands, seed source, seed history only if no existing deployment requires it, README seed instructions, and all seed-only placeholders. Do not delete migrations, backup, restore, production migration checks, or content revision support.
2. Add `db:empty` only if it requires an explicit database URL, an exact confirmation phrase, and a preflight backup. It must never run automatically on startup or in deployment. Prefer creating a new empty Turso database for the clean start over clearing a live one.
3. Add a short migration from the current schema to the empty-start release. If data is to be discarded, document the operational backup and cutover separately. Code must not erase a database merely because it has no modules.
4. Add `.env.production.example` and deployment docs for Vercel web plus self-hosted API. Use server-only `JOSE_INTERNAL_API_URL` for the Next rewrite, `JOSE_DATABASE_URL=libsql://...`, `JOSE_DATABASE_AUTH_TOKEN`, exact HTTPS `JOSE_WEB_ORIGIN`/`JOSE_ALLOWED_ORIGINS`, secure cookies, production Microsoft settings, and the correct reverse-proxy trust hop count.
5. Deployment order: create/backup Turso database; set API secrets; run `npm run db:migrate` against Turso; deploy API and verify `/ready`; set Vercel server-only rewrite target; deploy web; verify login, a teacher-only request, CSV export, and logout. Do not expose Turso token, OAuth secret, or session secret as `NEXT_PUBLIC_*`.

## Additional recommendations

- Add a class archive screen that keeps reports read-only instead of hiding them entirely.
- Add an explicit due-date/time-zone display. Store UTC milliseconds, show Asia/Manila only when that is the course policy, and label it in the teacher UI.
- Add assignment naming, for example `Module 2, first attempt`, so a repeated module is understandable in exports.
- Add a score-policy field before using exports as official grades. The current best-score calculation is a product choice, not a universal grading policy. Options include latest attempt, best attempt, or instructor override. Keep the raw attempts regardless.
- Add manual grade overrides as a separate audited table later. Never edit an attempt's server-graded score in place.
- Test the import format with two actual teachers before adding import-to-existing-module or media file uploads.
- Keep module revisions immutable once assigned. Editing and republishing should create a new revision; teachers choose whether to assign the new revision.

## Cursor master prompt

```text
Read `docs/reviews/2026-09-09-overall-audit-cursor-handoff.md`, the current source, and all applicable AGENTS.md files. Implement only Batch [NUMBER] on an isolated branch. Start by listing concrete source changes and any conflict with the current code; do not make assumptions from the handout when the source differs.

Keep the existing Next.js + NestJS + shared Zod + libSQL architecture. Do not replace Drizzle, authentication, assessment scoring, migrations, or content revisions. Do not deploy, alter a real database, send real email, hard-code authorization based on an email address, or delete data. Preserve unrelated working-tree changes.

For every API/data change, update the shared schema, API implementation, client call, and automated tests. Authorize sensitive teacher data on the server. Student profile requests must never change their name. Admin capability already includes teacher capability; persist Arlaus's admin role through the specified operational command, not a local switch or request-time special case. Gradebook rows and exports must preserve historical assignment revisions and exclude practice attempts.

For JMM, validate and preview before any write; create a new draft module atomically on confirmation; reuse existing lesson-block and game Zod schemas; sanitize Markdown; reject unsafe embeds and malformed/oversized input. For deployment work, keep all secrets server-only and do not run destructive reset commands.

Run the focused tests first, then `npm test`, lint, and production build if time permits. Report exact commands and results, migration/rollback steps, changed files, and unresolved external setup. Do not claim checks you did not run.
```

## Audit limits

The API test suite passed on this checkout: 21 suites and 159 tests. The shared package test run passed 134 tests, and the web test run reported 36 files and 129 tests before the combined command timeout; the API suite was then run to completion separately. `npm run build` passed for all three workspaces. `npm run lint` currently fails on the one React effect issue listed above. This review did not use a browser session, run against Turso, inspect a deployed Vercel/API environment, or perform a Microsoft Entra sign-in.
