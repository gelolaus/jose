# Jose simplification and reliability handoff

Prepared for Cursor Grok 5.6 on 8 September 2026.

- Repository: `C:\Users\gelo\Desktop\dev\jose`
- Inspected baseline: `5126548 feat(games): simplify learning into five friendly games`
- Deliverable: implement the changes below in the existing application, then verify the complete user journeys.

## Start here

The owner wants Jose to feel as simple and approachable as Duolingo: short instructions, friendly colors, obvious actions, and satisfying feedback. Use that interaction principle, not copied branding or artwork. The application name is **Jose**.

This handoff is documentation and a source review. It does not claim the requested changes are implemented. Classes and disappearing completed content are user-reported problems; reproduce them before assigning a definitive root cause. Application code was not changed during this documentation pass.

Do not stage, commit, push, deploy, or create a PR. Preserve the working tree and provide manual commit text when requested. Read `git status --short` before editing. Use npm, not pnpm. Read `apps/web/AGENTS.md` and relevant installed Next.js guides under `node_modules/next/dist/docs/` before frontend changes. Do not reset the database or rewrite authentication to make testing easier. Inspect configuration without exposing secrets.

The previous game commit already keeps only **Timeline, Quiz, Matching, Sorting, and Fill in the Blank**. Preserve it. Matching starts on the first flip, allows at least 60 seconds or 15 seconds per pair, has no mismatch penalty, and gives zero points on timeout. Timeline has ordering only; Quiz has no rationale step; Sorting excludes insufficient-evidence and discussion cards. Retired games remain readable as historical data but are excluded from active play.

## Required outcomes

| Area | Required result |
| --- | --- |
| Journal | Bookmarks only. No typed notes, reflections, excerpts, or editable saved content. |
| Profile | Small personal summary, XP, streak, lives, and useful settings. |
| Design | Friendly, direct, consistent, fewer simultaneous controls. |
| Branding | Jose, without Work and Life of Rizal as global branding. |
| Language | Remove Filipino interface translation and its controls. |
| Teacher area | Focused card-based editing, accessible controls, reliable saving. |
| Classes | Working create, join, assign, complete, and report journey. |
| Admin | Explicitly grant/revoke teacher access; only verified exact `apc.edu.ph` accounts qualify. |
| Learn | Completed lessons, games, and modules remain visible and revisitable. |
| Economy | Correct XP/streak/lives; one life per 10 minutes; distinct lesson reading reduces the wait by 2 minutes. |
| Cleanup | Repair broken core actions and remove unsupported optional clutter. |

### Recommended defaults for unspecified details

These are implementation recommendations, not additional statements from the owner. Use them unless repository constraints require a documented alternative.

- Name the destination **Bookmarks**, not Notes. Keep `/journal` working, preferably as a redirect to `/bookmarks`.
- Keep four student destinations: Learn, Practice, Bookmarks, Profile. Place My classes inside Learn rather than add another bottom-navigation item.
- Keep the existing cap of five lives and 10 XP for first completion of a path level. Do not invent another currency or change reward amounts incidentally.
- Keep Manila calendar days for streaks.
- Allow one lesson time credit per account and stable lesson ID for its lifetime. Refreshing, rereading, or publishing another revision does not renew eligibility.
- Do not bank credits while full. Register the read as processed with zero credit so it cannot be claimed on replay later.
- Preserve current life-loss scope: required learning, class assignments, and revisiting are not blocked by lives. The owner did not specify new deduction triggers. Audit existing consumers; do not silently charge every answer or undo Matching's no-penalty rule. If no meaningful life-consuming flow is reachable, report that gap rather than pretend the loop is complete.
- Removing a teacher means revoking their role, not deleting their account, content, classes, or student submissions.

## Confirmed source findings

| Finding | Source and implication |
| --- | --- |
| Journal has multiple catalogs and a text editor. | `apps/web/src/components/journal-view.tsx` has Notes, Glossary, Books, Characters, Places, reflection title/body fields, and exports. Replace the surface, not just the heading. |
| Journal is local and account-scoped. | `apps/web/src/lib/journal-store.ts` uses `jose.journal.v1:account:<id>`. Current storage does not establish cross-device sync. |
| Lessons save excerpts as well as bookmarks. | `lesson-journal-actions.tsx` exposes Bookmark, Save excerpt, Open journal. Remove excerpt capture from the new flow. |
| Profile mixes many unrelated sections. | `profile-showcase.tsx` combines identity actions, stats, course totals, module progress, artifacts, covers, and achievements. |
| Global branding includes the unwanted subtitle. | `app/layout.tsx` metadata and `app/learn/page.tsx` top-bar props contain Work and Life of Rizal. |
| Filipino is a stored preference. | `packages/shared/src/preferences.ts` accepts `en`/`fil`; `lib/reading-preferences.ts` changes document language and contains dictionaries. |
| Completed sections start collapsed. | `initialCollapsed()` in `components/path-view.tsx` collapses fully completed sections without a current node. This is a likely contributor to the disappearance report. |
| Module cards do not filter completed modules. | `module-grid.tsx` maps received modules directly. If whole modules vanish, inspect API responses/publication/caching too. |
| Classes have APIs and partial UI. | `classroom.controller.ts`, `classroom.service.ts`, `teach-classes-client.tsx` implement operations. The teacher UI asks for a Published module id and shares one selection state across class cards. |
| Joining is coupled to challenges. | `class-challenges-client.tsx` joins a class then reloads challenges. A class with no challenges needs a visible membership/assignment result. |
| Admin role mutation already exists. | `admin.controller.ts` has admin-protected `POST /admin/users/role`. This is not a complete management screen. |
| Admission already defaults to student. | `packages/shared/src/auth.ts` documents it; `auth.service.ts` creates student-role accounts. Do not assume automatic staff-domain promotion is the current production behavior. Inspect local test-role switching separately. |
| Granting needs exact staff eligibility enforcement. | `UsersService.setRoleByEmail` normalizes email, finds an account, protects admins, then updates role. Enforce verified exact staff domain in the authoritative mutation. |
| Student-domain spelling differs. | `APC_ADMISSION_DOMAINS` currently contains `student.apc.edu.ph`, singular. The owner wrote `students.apc.edu.ph`, plural. Neither qualifies for teacher access. Do not broaden admission without verified requirements. |
| Regeneration is currently 15 minutes. | `packages/shared/src/hearts.ts`: five-life cap and `HEART_DRIP_MS = 15 * 60 * 1000`. |
| Duplicate XP already has protection. | `markComplete()` inserts progress with conflict handling, then increments XP only for a new row. Preserve atomicity. |
| Requested lesson credit is not in completion. | `completeLevel()` handles progress, activity, achievements, and response but not the new 120-second credit. A private `refillHearts` helper is not proof of the requested behavior. |
| Active teacher editing uses the workspace. | `app/teach/modules/[moduleId]/levels/[levelId]/page.tsx` redirects to `/teach/modules/<id>?level=<id>`. Prioritize `teach-module-workspace.tsx`, not just older editor components. |

The preceding game implementation passed 113 shared tests, 118 web tests, 155 API tests, lint, and production build. Those checks predate this handoff and do not prove these new requirements. Run fresh checks after implementation.

## 1. Replace Journal with Bookmarks

Every readable lesson has one Bookmark / Bookmarked toggle. It persists after refresh and sign-in. Pressing it again removes the bookmark. Use icon plus text, `aria-pressed`, a pending state, and a brief save/error announcement. Roll back optimistic state if saving fails.

Bookmarks displays compact cards with canonical lesson title, module name, optional completed check, Open lesson, and Remove bookmark. There is no editable copy of the lesson. Remove reflection fields, title/body editing, selected excerpts, export toolbar, glossary/catalog tabs, and artifact inventories. Search may filter titles/module names, but its text is not saved as content. Do not add folders, tags, descriptions, or sharing.

Empty state: “Save a lesson to find it here.” Primary action: Browse lessons.

### Storage contract

Recommended: authenticated server bookmarks, unique on `(learnerId, levelId)`, with `createdAt`. Resolve title, module, and access from course content. Do not accept an arbitrary body, editable title, owner ID, HTML, or URL. Derive owner from the session and destination from the lesson ID.

Suggested routes, adjusted to repository conventions:

- `GET /bookmarks`: current account's bookmarks.
- `PUT /bookmarks/:levelId`: idempotently save an accessible lesson.
- `DELETE /bookmarks/:levelId`: idempotently remove the current account's bookmark.

Only lesson bookmarks are required. Enforce authorization on save and open. If a lesson becomes inaccessible, show a neutral unavailable state and Remove without revealing its hidden content. Do not delete a bookmark because of a temporary request failure.

Migrate only valid bookmark entries from the currently authenticated immutable account-scoped local store. Deduplicate by lesson ID. Never import display-name-keyed legacy blobs, another account's entries, typed reflections, excerpts, or submissions. Mark migration complete only after successful server persistence. Preserve unsupported legacy data untouched and hidden; this UI cleanup does not authorize bulk deletion of private text. New APIs must not accept freeform student content.

Inspect `journal-view.tsx`, `lesson-journal-actions.tsx`, `journal-store.ts`, `use-journal-store.ts`, `journal-catalog.ts`, `packages/shared/src/journal.ts`, navigation, account cleanup, and schema/migrations.

Acceptance: one card per lesson; no content editor; correct refresh/cross-device persistence if server storage is implemented; no duplicates on retry; no account leakage; completed lessons open normally.

## 2. Simplify Profile and shared UI

Profile contains avatar, display name, Edit profile, and three compact stats: XP, day streak, Lives. Below that is a short settings list: Reading settings, My classes if needed, Teacher area for authorized users, Manage teachers for admins, Sign out. If shown, email is read-only; editing profile text cannot change identity or role.

Remove the course-total explainer, full module journey, artifact inventory, cover-unlock text, and large achievement grid from the default profile. Preserve historical data. Do not move all removed clutter to another oversized page. An optional achievements link is acceptable only if its destination works and helps learners.

Use the current rounded typeface and Jose design tokens. Prefer theme-aware surfaces, green primary actions, blue information, amber streaks, and coral lives/error accents. Bright fills indicate actions or selection. Do not add a competing design system or blindly combine pale surfaces with light text in dark mode.

Use 44px minimum controls, visible focus, accessible icon labels, status text in addition to color, and readable body text. Check 360, 390, 768, 1024, and 1440px widths, 200% zoom, keyboard navigation, reduced motion, and both themes. Success feedback must not require sound or delay navigation.

Use ordinary labels: Profile, Edit profile, Settings, Lives, Bookmark, Classes, Create module, Preview, Publish. Remove “explorer”, “field journal”, “arcade lives”, and technical explanations from product chrome. Keep legitimate historical/course prose intact.

## 3. Jose branding and English-only settings

Replace global Work and Life of Rizal branding with Jose in metadata, top bars, login chrome, manifests if present, accessibility labels, and fallbacks. Page titles may retain the existing `page | Jose` convention. Do not mass-replace academic titles or teacher-authored content.

Remove Filipino interface translation and the language selector when English is the only option. Keep text size, reduced motion, and sound. Remove unavailable narration/translation promotion instead of presenting dead controls.

Migrate persisted `locale: fil` to `en` while preserving text size, motion, and sound. Cover any server preferences and document `lang`. Test old, missing, and malformed storage. Do not remove Filipino quotations or source material from lessons.

Inspect `app/layout.tsx`, `app/learn/page.tsx`, `learning-shell.tsx`, `top-bar.tsx`, `reading-preferences-form.tsx`, `reading-preferences.ts`, `preferences-boot.tsx`, and `packages/shared/src/preferences.ts`.

## 4. Keep completed learning visible

Do not filter out completed modules/nodes or automatically collapse completed sections on load or completion. A current-step shortcut can advance, but the full path/library remains available. Completed items show a check and Review / Read again. A finished module shows Completed and Review module.

Reproduce lesson, game, section, and final-module completion. Compare API payloads before/after, then inspect collapsed state, rendering, scroll restoration, caching, and next-item selection. Start with `PathView.initialCollapsed`; inspect `module-grid.tsx`, `level-node.tsx`, `continue-learning-card.tsx`, shared progression functions, and curriculum path/publication methods too.

Do not reintroduce retired advanced games. Completion, archival, unpublishing, and retirement are different states. Preserve published revision and authorization rules; this request does not expose unpublished drafts. If withdrawn content needs a separate historical-reader policy, report that boundary.

Replays cannot duplicate XP, lesson credits, artifacts, or assignment completion. They should create fresh game attempts while preserving historical scores. Keep the previous attempt-ID `GamePlayer` remount fix.

## 5. Teacher editing overhaul

### Structure

`/teach` shows module cards with title, Draft/Published status, item count, and Open. Create module is a visible primary action. Classes is a sibling destination. Duplicate/archive and other secondary actions live in a labeled menu.

The module workspace has a header with title, save status, Preview, and Publish. Below it, section cards form an outline. Expanding a section shows lesson/game cards; selecting one opens a focused editor. Do not show module metadata, section metadata, every lesson field, imports, readiness details, templates, and preview simultaneously.

Desktop can use a compact outline beside one editor. Mobile uses one pane at a time with Back to outline. Preserve the current selection URL so refresh, deep-linking, and browser Back work. Cards do not replace real buttons, labels, or ownership checks.

### Editing behavior

- Lesson editor: Title, then content blocks. Only the selected block exposes its controls. Source/citation fields belong in a clearly labeled optional section where appropriate; preserve required academic metadata.
- Game editor: only the five supported games. Show one quiz question/blank sentence at a time with a compact item list. Matching edits pairs, Timeline edits events, Sorting edits categories/cards. Do not restore justification controls.
- Reordering has Move up/Move down controls as well as drag-and-drop.
- Autosave exposes Unsaved, Saving, Saved, and Could not save. Retain `expectedRevision` conflict handling. A slow response cannot overwrite another selected lesson or a newer draft.
- On navigation during saving, flush or retain the exact draft. Never claim saved before acknowledgment. Retry must retry that operation, not whichever item happens to be selected now.
- Preview uses the actual simplified games but cannot award XP, spend lives, mutate progress, or submit formal assignments.
- Publish opens a focused summary of actionable blockers with links to affected fields. Optional fields must not appear required. Preserve real publishing checks.
- Archive/remove names the affected item and preserves submissions. Destructive controls do not sit next to routine typing controls.

Inspect `teach-module-workspace.tsx`, `teach-module-list.tsx`, `teach-shell.tsx`, `teach-game-editor.tsx`, `lesson-blocks-editor.tsx`, `use-draft-autosave.ts`, `use-pending-map.ts`, and `teach-mutations.ts`. Trace routes before editing older parallel editor components. Delete unused components only after checking references.

Acceptance: create a module, section, lesson, and game; edit, switch items, refresh, reorder, preview, publish, and read as a student. Repeat on mobile, with a failed save, and with a revision conflict. No lost edits or false success.

## 6. Classes: finish the basic workflow

Do not rebuild the backend merely because the user reports Classes as broken. Trace the browser request through the Next `/api` proxy, controller, session/role checks, ownership, schema, migrations, and database. Record the exact failing step and response. A 403 is not an empty class list; an outage is not “No classes”.

Required journey:

1. An authorized teacher creates a named class. Disable duplicate submission while pending.
2. Show the invite code and Copy. The database stores a hash, so do not pretend the original code can be recovered after refresh. Offer Generate new code with clear notice that the old one stops working.
3. A student opens My classes under Learn and joins by code. Show membership even if there are no assignments or optional challenges.
4. The teacher selects a published, authorized module by title. No raw IDs. Keep selection per class or inside a dedicated class detail view.
5. The student sees the assignment, starts it, completes it, and can review it afterward.
6. The teacher sees the roster and report after refresh. Results come from formal server-assessed activity, not free practice or teacher preview.
7. The teacher can archive a class without deleting past submissions. Repeat joins are idempotent. Invalid, rotated, and rate-limited codes produce useful errors.

Existing routes:

- `GET/POST /teach/classes`
- `POST /teach/classes/:id/invite`
- `DELETE /teach/classes/:id`
- `POST /teach/classes/:id/assignments`
- Report and CSV routes under `/teach/classes/:id/assignments/:assignmentId`
- `POST /classes/join`
- `GET /assignments/mine`

Inspect `classroom.service.ts`, `classroom.controller.ts`, `teach-classes-client.tsx`, `class-challenges-client.tsx`, `path-api.ts`, `packages/shared/src/classroom.ts`, and classes/membership/assignments/revisions tables. Add a student membership-list API if existing responses cannot show classes without assignments. Keep challenges out of the critical join/assignment flow.

Verify whether membership consistently uses user IDs or learner IDs. Do not assume they are interchangeable because fixtures align. Teacher A cannot read/modify teacher B's class; student A cannot submit or retrieve another student's private report. Check report behavior for retired levels: new active assignments must not be impossible because a historical snapshot contains an unsupported game. Preserve historical results and explicit revision semantics.

Test create, reload, join, duplicate join, rotate code, invalid code, assign, student completion, teacher report, archive, and unauthorized access. A successful class-creation toast alone is insufficient.

## 7. Admin-managed teacher access

Build a small protected Manage teachers page: current teachers, search for eligible existing accounts, Grant teacher access, Remove teacher access. No general account-deletion or arbitrary permission editor is needed.

Server requirements:

- New admitted accounts remain students, including `@apc.edu.ph` accounts.
- Only an authenticated active admin can grant/revoke teacher access.
- Promotion checks the existing verified admission mailbox's exact normalized domain: `apc.edu.ph`. Never use `includes`, suffix matching, display name, or an unverified request field as proof.
- Reject `student.apc.edu.ph`, `students.apc.edu.ph`, other subdomains, personal email, and lookalikes such as `apc.edu.ph.example.com`.
- The ordinary role endpoint cannot grant admin or demote admin. Preserve operator-controlled bootstrap.
- Students/teachers cannot escalate through direct requests, forged headers, or a development role switch in production.
- Revocation applies to subsequent protected requests in an already-open session. Verify current database roles are read, or invalidate sessions/caches as needed.
- Revocation does not delete classes/content. Keep ownership visible to the admin; do not silently transfer it.
- Audit actor, target, prior/new role, and timestamp through the existing audit mechanism or a small dedicated table. Never log tokens.

Reuse `POST /admin/users/role` where appropriate. Add admin-only paginated list/search with minimal fields if needed. The first version can require a person to sign in once before promotion; communicate that instead of inventing email invitation delivery.

Inspect `admin.controller.ts`, `users.service.ts`, `authorization.service.ts`, `session.service.ts`, `session.guard.ts`, `teacher-role.guard.ts`, `packages/shared/src/auth.ts`, `use-jose-session.ts`, and navigation guards. Audit existing teacher eligibility without blindly mass-demoting accounts. Report legacy ineligible teachers for deliberate remediation. Distinguish localhost test identities from production rules.

Acceptance cases: staff signs in as student; admin grants eligible staff; existing session gains access on refresh; admin revokes; that session is denied on its next protected request. Both student-domain spellings fail promotion. Non-admin API calls fail, and admin bootstrap protections remain intact.

## 8. XP, streak, and lives

### Shared rules and boundaries

Use **Lives** in visible copy. Internal `hearts` names can remain to avoid needless migrations. Keep the heart icon. Use one shared rule source so Profile, header, API responses, and help agree. The server owns balance, timestamps, and rewards. The browser displays a countdown using authoritative state.

XP retains 10 XP for first completion of each path level. Retries, double-clicks, concurrent tabs, replays, and practice cannot duplicate path XP. Progress insertion and XP award remain atomic. Preserve the current treatment of chest-level XP unless explicitly changing it as a separate decision; removing artifact UI does not authorize changing historical rewards.

Streak counts qualifying activity once per Manila calendar day. More activity that day does not increment again. Test midnight, consecutive days, a missed day, new accounts, and stale display after inactivity. Opening Profile or rendering a lesson does not count as completion. Decide the displayed stale streak consistently with the existing server rules; do not show contradictory values in different screens.

### Ten-minute regeneration and lesson credit

Set regeneration to **600,000 ms per life**. A qualifying distinct lesson completion adds **120,000 ms of regeneration progress**. This is time credit, not two lives and not a two-minute regeneration interval.

Examples, ignoring passive time during the action:

| Before | Action | After |
| --- | --- | --- |
| 3/5 lives, next in 10:00 | New qualifying lesson | 3/5, next in 8:00 |
| 3/5 lives, next in 1:00 | New qualifying lesson | 4/5, next in 9:00; one minute carries forward |
| 4/5 lives, next in 1:00 | New qualifying lesson | 5/5, timer hidden, no banked excess |
| 3/5 lives, next in 8:00 | Same lesson again | No reward and no timer reset |
| 5/5 lives | New qualifying lesson | Stay full; no future banked credit |

Recommended transaction:

1. Load fresh balance and reward eligibility using server time.
2. Apply passive regeneration first and cap at five.
3. Insert a unique lesson-credit record keyed by account/learner and stable lesson ID, or extend suitable existing state with equivalent atomic semantics. Concurrent requests have only one winner.
4. If newly eligible and below cap, add 120 seconds of elapsed regeneration progress, then calculate regeneration again. With an elapsed-time anchor this usually means moving the anchor backward, not forward. Test against the examples.
5. At full balance, discard excess. The next life loss must start a fresh ten-minute wait rather than using an old full-balance timestamp.
6. Return authoritative lives, server time, next regeneration timestamp, and whether credit was applied. Refresh every visible stat from this response.

“Lesson read” means successful completion of an accessible lesson using the existing completion action. It is not a GET request, render, bookmark, or scroll event. Scrolling cannot prove human reading. Do not add surveillance or a long mandatory dwell timer. Existing completion semantics plus unique reward eligibility prevent repeated-lesson farming.

Recommended legacy policy: mark already completed lessons as consumed during migration, without granting lives. This prevents replaying the old course to farm newly introduced credits. Preserve original timestamps. New publication revisions do not renew the same stable lesson ID's credit. Document the migration and its cutoff.

Trace all current life-spend/refill callers. Verify deductions are server-owned, idempotent, and bounded at zero. Preserve required learning at zero under the default scope above. The task authorizes the interval and lesson credit, not arbitrary new deductions. If life usage remains optional, explain the actual rule in one short help sentence. Do not claim a complete economy merely because a heart counter animates.

Files: `packages/shared/src/hearts.ts`, `streak.ts`, related tests, `curriculum.service.ts` (`completeLevel`, `markComplete`, learner synchronization, life loss, activity), database schema/migrations, `top-bar.tsx`, `profile-showcase.tsx`, `lesson-player.tsx`, game completion clients.

Tests: 599,999/600,000 ms, several elapsed intervals, cap, malformed values, clock skew, background tab, refresh, simultaneous loss/credit, duplicate completion, different lessons, repeats, full balance, and content revision changes. Do not trust client-submitted balances or elapsed time.

## 9. Further simplification review

For every visible feature ask: does it help someone learn, find saved lessons, understand progress, or manage a class? Does it work end to end? Can it require fewer decisions?

Recommended removals from default surfaces:

- Journal catalogs, reflections, excerpts, cover inventory, and exports.
- Profile artifact/achievement walls and repeated course summaries/navigation.
- Translation/narration placeholders or offline/download promises without working behavior.
- Challenge setup mixed into basic joining and assignments.
- Teacher imports/templates/collaborator tools displayed constantly. Keep functioning advanced tools in an optional menu instead of deleting data contracts blindly.
- Raw IDs, JSON, publication internals, and verbose economy explanations in student flows.

Useful small additions: bookmark state, completed checks, real save status, module picker, Copy invite, empty/error/retry states, lives countdown. Do not add leaderboards, shops, more games, currencies, social feeds, streak freezes, or a note editor in this pass.

Maintain a defect ledger with route, role, reproduction steps, expected/actual behavior, evidence, proven root cause, fix, and regression check. Prioritize access failures, lost edits, inaccessible learning, wrong rewards, and failed Classes ahead of animation polish. “Fix all broken stuff” means audit the reachable core journeys and report unresolved dependencies honestly, not promise an unbounded guarantee.

## 10. Implementation sequence and validation

Work in reviewable stages; do not stop at a mockup:

1. Reproduce reported failures. Record auth mode, backend availability, and applied migrations without secrets.
2. Fix completed-content visibility and authoritative teacher eligibility/access.
3. Implement bookmark storage/API/migration and replace Journal/navigation.
4. Implement regeneration and idempotent lesson credit, then shared stats refresh.
5. Simplify Profile, branding, and English-only preference migration.
6. Rework the active teacher workspace while preserving saves/conflicts.
7. Complete Classes and admin screens against working APIs.
8. Audit remaining actions, remove unsupported clutter, and check responsive/accessibility behavior.

Use the existing migration system in `apps/api/src/db/`. Test both fresh and populated databases. Add required uniqueness/index constraints. Back up before manually applying migrations outside test databases. Do not erase accounts, existing private text, published content, or submissions. Document rollback implications and schema compatibility. A source migration is not evidence it ran in the user's environment.

Run relevant focused checks while changing behavior. After integration run:

```powershell
npm run lint
npm test
npm run build
```

Extend shared heart/streak/preference tests; web bookmark/account-isolation, profile, teacher save/navigation, and game replay tests; API auth, atomic-progress, publishing, and classroom tests. Prefer behavioral tests over snapshots mirroring JSX. Verify migrations and browser journeys as well as unit tests.

### Browser acceptance matrix

| Role | Journey that must pass |
| --- | --- |
| Student | Sign in, Learn, complete, return, find completed content, reopen, verify no duplicate XP. |
| Student | Bookmark a completed lesson, refresh, open from Bookmarks, remove; another account cannot see it. |
| Student | Profile/settings remain simple and preserve accessibility preferences after migrating Filipino locale. |
| Student | Join class without challenges, see membership, open/complete assignment, review afterward. |
| Teacher | Create class, copy/rotate code, pick module by title, assign, view actual student report. |
| Teacher | Edit, switch during save, retry failure, resolve conflict, preview, publish. |
| Admin | Grant staff, reject student-domain promotion, revoke, verify existing-session access changes. |
| All | Jose branding, no dead controls, readable themes/mobile layout, keyboard access, visible primary actions. |

Verify persisted rows and real API responses for roles and rewards. A toast is not persistence evidence. Mock-auth browser tests do not prove Microsoft production sign-in. If a provider, deployment setting, or credential blocks a check, report the exact boundary and remaining manual test.

### Final delivery from Cursor

Report outcomes and changed files by feature, actual command results, migrations created/applied, browser journeys verified, remaining defects/dependencies, and deviations from recommended defaults. Include before/after screenshots for Profile, Bookmarks, teacher editing, and Classes when possible. Provide concise manual commit text. Do not claim completion until core acceptance passes or a specific external blocker is evidenced.
