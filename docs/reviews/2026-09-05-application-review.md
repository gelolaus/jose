# Jose: application review and implementation handoff

Reviewed 5 September 2026, against commit `912afee`. Primary audience: Asia Pacific College RIZLIFE students; secondary audience: middle school, JHS, and SHS learners. This is a product and source-code review, not a certification of production security or a validated learning-outcome study. “10× better” is a direction, not a measured result.

## Recommendation

Keep the Next.js/NestJS/shared-schema foundation and the five existing game engines. Build a dependable learning product around them. The strongest direction is **Jose: a historical investigation adventure**: explore a chapter, examine evidence, solve a challenge, explain what you learned, and collect an artifact for your journal.

The existing app has real strengths: shared Zod contracts, sanitized Markdown, responsive navigation, reusable play/build game components, teacher playtesting, explanatory feedback, tap alternatives for placement games, and reduced-motion CSS. Preserve those. Its biggest limitation is that it is still a shared demo with a playful presentation, rather than an individual, classroom-ready experience.

Three possible directions:

1. **Recommended: investigation adventure with a focused study mode.** Best balance of college relevance, fun, and achievable scope. Reuse boards and add a coherent chapter loop.
2. **Classroom platform first.** Fastest route to teacher utility and reporting, but risks retaining the worksheet feeling unless a chapter is redesigned alongside it.
3. **Full RPG or 3D world.** Potentially expressive, but much greater asset, accessibility, performance, and authoring burden. Defer until a smaller version demonstrates learning value.

Assumption: signed-in institutional features remain APC-only, as requested. Younger APC learners can use the same admission policy. Learners outside APC need an explicitly separate guest/public experience; do not silently weaken the school account rule to accommodate the broader audience.

## How to use this handoff

Each numbered item below is an implementation ticket with evidence, a fix instruction, and a completion check. P0 means required before real school accounts/data; P1 means the next major usability release; P2 means expansion after the foundation works. Effort S/M/L is relative scope, not a calendar estimate. “Confirmed” means visible in the reviewed code; “Proposal” is a product/design recommendation requiring validation with users.

Give Cursor one coherent batch at a time using the prompt at the end. Do not ask it to implement all tickets in one unreviewable rewrite. File references are repository-relative so they remain portable to Cursor.

## Foundation and operational correctness

### 01 · P0 · L · Replace the shared demo identity [Confirmed]
**Evidence:** `apps/api/src/curriculum/curriculum.service.ts` uses `DEMO_LEARNER_ID` for learner, progress, misses, and attempts. `apps/web/src/lib/explorer-identity.ts` stores cosmetic identity in localStorage. Changing a name does not create a separate learner.
**Cursor fix:** Introduce users, external identities, sessions, and learner profiles. Resolve learner ID from the verified server session on every request, never from a caller-supplied learner ID. Sync display name/avatar to the account. Isolate demo data behind an explicit demo mode; do not assign the shared historical progress to a new student.
**Done when:** Two independent sessions have independent XP, hearts, profile, attempts, and unlocks; signing out clears sensitive client state; re-login on another device restores the correct profile.

### 02 · P0 · L · Protect teacher actions with roles and ownership [Confirmed]
**Evidence:** `apps/api/src/curriculum/teach.controller.ts` exposes read/create/update/delete operations without guards. Teacher studio is linked from the student profile. CORS is not authentication.
**Cursor fix:** Add server-side student/teacher/admin permissions and module collaborator/owner checks. Bootstrap the first admin through a controlled operational procedure. Default every newly admitted account to student. An `@apc.edu.ph` address must not automatically grant teacher access. Hide teacher navigation for students, but enforce every permission in the API too.
**Done when:** Anonymous requests return 401; students receive 403; teachers cannot edit another owner's module without a grant; permission tests exercise direct HTTP calls, not just hidden buttons.

### 03 · P0 · L · Add Microsoft login with APC admission [Proposal]
**Evidence:** No auth subsystem exists. See the detailed Microsoft design below.
**Cursor fix:** Implement the callback and admission checks on the server, bind the stable provider identity to independently verified APC mailbox ownership, and issue the Jose session only after admission. Add denial, switch-account, cancellation, and consent-blocked states.
**Done when:** Both allowed domains work; outsiders, missing/untrusted email claims, expired callbacks, and forged identity inputs cannot obtain an authenticated Jose session. Teacher access remains separately granted.

### 04 · P0 · M · Enforce publication checks on every student endpoint [Confirmed]
**Evidence:** `getModulePath` checks `published`; `getPlayLevel`, `completeLevel`, `recordMiss`, and `submitAttempt` use `levelContext` without this check. `getFeaturedPath` also omits it.
**Cursor fix:** Create a student-visible content resolver that consistently requires the relevant published revision. Use a distinct authorized preview resolver for teachers. Apply visibility checks to reads and mutations.
**Done when:** Knowing an unpublished level ID does not permit reading it, recording an attempt, changing hearts, or unlocking progress. A teacher preview still works without student progress mutations.

### 05 · P0 · L · Make assessed scores authoritative [Confirmed]
**Evidence:** `submitAttempt` trusts browser `score` and `maxScore`; `getPlayLevel` sends the full game answer configuration. A caller can submit a fabricated score. Finishing at zero currently completes a game; this is an explicitly parked pass-mark feature, not a regression.
**Cursor fix:** Introduce server-issued attempt IDs tied to learner, content revision, and mode. Submit answers/events and compute assessed scores on the server; strip answer keys from assessment delivery. Deduplicate finish requests. Keep immediate-answer practice mode explicitly separate. Separate completion, mastery, and grades; do not retroactively turn practice stars into grades.
**Done when:** Fabricated scores, another learner's attempt ID, duplicate finishes, and stale revisions are rejected or safely deduplicated. Legitimate practice completion remains available without imposing an arbitrary pass mark.

### 06 · P0 · M · Make progress and economy writes atomic [Confirmed]
**Evidence:** `markComplete` checks completion, inserts it, then reads/writes XP separately. `recordMiss` reads then writes hearts. Concurrent requests can conflict or lose updates. `moveLevel` swaps positions in separate writes.
**Cursor fix:** Use transactions and conflict-aware inserts; increment XP atomically only when first completion is inserted. Make heart changes conditional and idempotent if retained. Make content creation/reordering/deletion transactional too.
**Done when:** Simultaneous identical completions award XP once; simultaneous distinct completions preserve both awards; retries cannot double-spend hearts; injected failures do not leave half-created content or half-swapped order.

### 07 · P1 · M · Preserve a result when saving fails [Confirmed]
**Evidence:** `game-player.tsx` shows the celebration even when submit fails. Its Retry restarts the board; Continue exits. `onMiss` returns `ok` on network failure. There is no durable resume state.
**Cursor fix:** Separate playing, completed-locally, saving, saved, and save-failed states. Offer “Retry saving” independently of “Play again.” Persist a minimal attempt snapshot keyed by account and revision; reconcile with the server using idempotency. Mark unsaved results visibly. Avoid pretending a failed miss request was synchronized.
**Done when:** Disconnect on the final answer, refresh, reconnect, and save once without replaying the board or duplicating XP. Logging out cannot expose the previous learner's draft to the next user.

### 08 · P0 · M · Separate seeding from application startup [Confirmed]
**Evidence:** `DatabaseService.onModuleInit` calls `seedIfEmpty`; that function always calls `ensureSeededGames` and `ensureAteneoDays`. Missing seeded games/modules can be reinserted after a teacher deletes them. Demo XP, streak, and progress are prefilled.
**Cursor fix:** Use explicit, versioned migration and seed commands. Make demo seeding opt-in and keep seed application history. Normal startup must not restore deleted editorial content or invent learner achievements.
**Done when:** Delete a seeded extra or the Ateneo module in a disposable database, restart, and confirm it stays deleted; fresh production accounts start with honest statistics.

### 09 · P0 · M · Add migration, backup, and restore procedures [Confirmed gap]
**Evidence:** `ensure-schema.ts` duplicates schema creation and manually ensures one column; no versioned migration directory or restore procedure was found. Data defaults to a local SQLite file.
**Cursor fix:** Establish one authoritative migration workflow for SQLite/libSQL, migration history, pre-deploy backup, tested restore, and persistent-volume/cloud database configuration. Run migrations as a controlled deployment step. Specify recovery targets with the project owner before production.
**Done when:** An older representative database upgrades without losing attempts; a backup restores into a fresh environment and preserves account/progress/content integrity. Ephemeral server restarts do not erase data.

### 10 · P0 · S · Finish database and deployment configuration [Confirmed]
**Evidence:** `database.service.ts` calls `createClient({ url })` without an auth token, although the future-work document proposes `JOSE_DATABASE_AUTH_TOKEN`. `main.ts` only allows localhost web origins; `path-api.ts` defaults to localhost.
**Cursor fix:** Validate environment variables at boot; pass the server-only libSQL token when using a hosted database. Configure allowed origins and API routing per environment. Prefer a same-origin browser API path for the eventual cookie session. Never expose database or OAuth secrets through `NEXT_PUBLIC_*`.
**Done when:** A staging browser can read and mutate authorized data over HTTPS; server-side rendering reaches the API; invalid production config fails clearly; secrets remain absent from the client bundle.

### 11 · P1 · M · Make failures observable and supportable [Confirmed gap]
**Evidence:** `/health` returns a constant `{ok:true}`. There is no application-level request correlation, readiness database probe, or monitoring integration in the inspected code.
**Cursor fix:** Keep a cheap liveness check and add bounded readiness checks. Add structured request logs, correlation IDs, sanitized error reporting, and metrics for callback failures, save failures, API latency, and database errors. Provide a user-visible support reference without tokens, answers, or email addresses in logs.
**Done when:** A simulated database outage fails readiness and raises an actionable alert; a student error reference traces to one request; ordinary logs contain no credentials or raw student answers.

### 12 · P1 · M · Bound queries and payloads [Confirmed]
**Evidence:** `listPublishedModules`, `orderedLevelIds`, and `buildPath` issue queries in loops, including repeated completion queries. Some content strings/arrays and the attempt payload are insufficiently bounded at the schema level.
**Cursor fix:** Batch module counts, sections, levels, and per-user completion queries; add indexes based on actual query plans. Add pagination for future teacher reports and explicit content/request limits. Add rate limits to login, mailbox verification, mutations, and attempts.
**Done when:** Increasing catalog size does not create one round trip per level/section; oversized payloads return useful 4xx responses; representative classroom concurrency is measured with stated dataset and environment.

### 13 · P1 · M · Establish a release gate [Confirmed gap]
**Evidence:** Unit/component tests exist, including six curriculum service tests, but no `.github` CI workflow or browser E2E suite was found. `turbo.json` lint does not depend on the shared package build although shared exports point to `dist`.
**Cursor fix:** Add clean-checkout install, shared build, type checks, lint, tests, production build, and a small critical-path E2E suite. Ensure task dependencies build shared declarations before API lint. Add staging smoke checks and rollback instructions; inspect dependency advisories rather than upgrading blindly.
**Done when:** A fresh checkout passes without previously generated `dist`; CI catches denied teacher access, cross-user leakage, broken publishing, and interrupted-save regressions.

## Teacher studio: the highest-leverage usability investment

### 14 · P1 · L · Replace fragmented forms with a module workspace [Confirmed + Proposal]
**Evidence:** `teach-module-editor.tsx` exposes module fields, separate section forms, per-level buttons, and another route for level content. `teach-level-editor.tsx` separately saves title and body.
**Cursor fix:** Build a three-area workspace: collapsible outline, current editor, and preview/validation pane. Mobile uses explicit Outline/Edit/Preview tabs. Start with a short wizard: title, intended learners, objective, then a starter structure. Keep the current data hierarchy under the friendlier UI.
**Done when:** A first-time teacher can create one lesson and one quiz, playtest, and publish without Markdown knowledge or route hunting. Measure time and errors in a small teacher usability session.

### 15 · P1 · M · Autosave drafts and prevent lost edits [Confirmed]
**Evidence:** Editors hold unsaved state locally; there is no dirty-navigation guard. The Saved state in `TeachLevelEditor` can remain visible after further edits; title/content saves are separate.
**Cursor fix:** Add debounced draft autosave with explicit saving/saved/offline/failed indicators, Ctrl/Cmd+S, local recovery, and unsaved-exit handling. Use revision/ETag conflicts to prevent a second editor from silently overwriting work. Keep a single coherent save status.
**Done when:** Editing after a successful save marks the document dirty; a failed save is recoverable after refresh; concurrent editors receive a conflict-resolution path.

### 16 · P1 · M · Make all author mutations resilient [Confirmed]
**Evidence:** Up/Down handlers in `teach-module-editor.tsx` await mutations without a catch. Several add/save/delete operations lack operation-specific pending locks. Add callbacks catch errors internally, so child `.then` handlers can clear form values even after failure.
**Cursor fix:** Return explicit success/failure or propagate errors consistently; clear inputs only after success. Disable just the affected operation while pending and retain edits on failure. Prevent duplicate submits and show errors beside the affected field/item.
**Done when:** Simulate failed add, reorder, and save requests; no input vanishes, no unhandled rejection occurs, and rapid clicking creates only the intended item.

### 17 · P1 · M · Add templates, duplication, and bulk import [Proposal]
**Evidence:** Authors build levels one by one; default content is generic. No duplicate/import workflow exists.
**Cursor fix:** Ship curated lesson+retrieval, source investigation, timeline, and chapter-checkpoint templates. Add duplicate module/section/level with fresh stable IDs and draft status. Add schema-validated CSV/JSON question import with mapping, preview, and row errors. Make all-or-nothing versus partial import explicit.
**Done when:** A teacher imports ten questions and sees precise errors before committing; duplication preserves content but never copies student history or publishes automatically.

### 18 · P1 · M · Add rich lesson blocks and a reusable source library [Proposal]
**Evidence:** `LessonForm` is a Markdown textarea plus YouTube URL. Memory cards use external image URLs.
**Cursor fix:** Add accessible text, image, quote/source, glossary, video/transcript, and checkpoint blocks with live preview. Keep sanitized Markdown import/export where practical. Provide an asset picker with alt text, attribution, file/type/size validation, and explicit upload progress.
**Done when:** A teacher authors an illustrated, cited lesson without writing markup; unsafe embeds are rejected; missing images and unavailable videos have useful text alternatives.

### 19 · P0 · L · Introduce draft revisions and reversible publication [Confirmed]
**Evidence:** `putLesson` and `putGame` update content immediately even when a module is published. Deletion removes attempts and progress. The schema has a single published boolean with no release snapshot.
**Cursor fix:** Save edits into drafts; publish immutable revisions after validation. Pin attempts and class assignments to the content revision used. Replace ordinary deletion with archive/trash and an undo window; make permanent deletion a separate privileged action with impact information. Add rollback and audit history.
**Done when:** An in-progress learner finishes against the original content; a teacher can correct a draft without affecting students; archiving preserves historical results and restoring content does not duplicate them.

### 20 · P1 · M · Make publishing a quality checklist [Confirmed]
**Evidence:** `publishProblems` checks nonempty Markdown and schema-valid games; seeded “Write the lesson here” and generic questions can pass. `putGame` accepts any game type without keeping `levels.gameType` consistent. Game schemas do not enforce unique IDs or valid sort bucket references.
**Cursor fix:** Add structured readiness errors linked to specific fields; require explicit author review, objectives, and sources where appropriate. Validate unique IDs, valid bucket references, decoy/answer ambiguity, blank placement, and game-type consistency. Separate warnings from blockers and allow drafts to be incomplete.
**Done when:** Invalid relations/types cannot be published; unreviewed defaults remain drafts; every publish error opens the exact editor location needing attention.

### 21 · P1 · M · Reorder and move content safely [Confirmed + Proposal]
**Evidence:** Levels move only Up/Down within one section. New sort orders use sibling counts, which can collide after gaps from deletions. There is no section/module ordering UI.
**Cursor fix:** Add drag handles plus keyboard and button alternatives, cross-section moves, and bulk selection. Normalize sibling ordering transactionally and return a canonical outline after mutations. Preserve stable IDs and explain changes to prerequisites.
**Done when:** Delete/add/move sequences produce deterministic order; users can reorder without dragging; existing progress does not disappear just because an item moved.

### 22 · P1 · L · Add classes, assignments, and useful teacher reporting [Proposal]
**Evidence:** No class/roster/assignment schema exists. Attempts are stored but no teacher monitoring endpoint/UI exists; this was already identified in future-work docs.
**Cursor fix:** After identity and revisions, add class membership, invite codes with abuse protection, assigned revisions, dates, and teacher-scoped reports. Show not-started/in-progress/completed separately from mastery, common misconceptions, and latest/best attempts. Include CSV export with spreadsheet-formula injection protection.
**Done when:** A teacher assigns a module to one class and sees only that class's authorized records; students see exactly what to do next; archived students/content retain the required history.

## Student experience and learning quality

### 23 · P1 · M · Lead with “Continue learning” [Confirmed + Proposal]
**Evidence:** `ModuleGrid` opens on catalog cards, not a personalized next action. Completion returns to the path rather than the next activity.
**Cursor fix:** Put a primary Continue card above the catalog with chapter, next activity, approximate duration, and assignment context. Add next-activity continuation with an optional map detour. Restore the last meaningful location instead of sending users to the top repeatedly.
**Done when:** A returning learner starts the appropriate activity in one action; a completed course suggests review or exploration rather than a dead-end Continue button.

### 24 · P1 · M · Make the path navigable on small screens [Confirmed]
**Evidence:** `path-view.tsx` allocates 176px per node; its chapter navigation appears only at `xl`. Long modules require substantial scrolling on phones.
**Cursor fix:** Keep Adventure Map and add a compact accessible List view. Add a mobile chapter picker, jump-to-current button, clear prerequisites, and preserved scroll position. Use collapsible completed chapters where helpful.
**Done when:** A phone user can reach a later unlocked chapter without scrolling through every earlier node; keyboard and zoom users can access every item without clipping.

### 25 · P1 · M · Update the visual voice for the actual audience [Confirmed + Proposal]
**Evidence:** README, metadata, and sidebar say “kids-first”; the main UI uses Fredoka, very rounded shapes, dense bold type, and a smile icon mascot.
**Cursor fix:** Adopt a historical field-journal art direction with purposeful illustrations, readable body text, chapter maps, and artifact imagery. Keep warmth and tactile controls, reduce decorative weight in study/authoring screens. Offer Adventure and Focus presentation settings, not a “children versus adults” label. Replace dismissive/infantile error copy.
**Done when:** The same lesson feels credible to college students and approachable to younger learners. Validate with representatives of both groups; do not equate mature with dark mode or smaller text.

### 26 · P1 · L · Add learning depth, not just more questions [Confirmed + Proposal]
**Evidence:** Seed lessons are short fact summaries; the schema has no objectives, citations, difficulty/scaffolding metadata, or instructor review record. Some wording is imprecise, including “After 1896” in the trial lesson and “reform, not a carnival.”
**Cursor fix:** Map the curriculum to the actual APC RIZLIFE syllabus when available. Author chapter objectives, provenance, key vocabulary, contextual explanations, and source interpretation/reflection. Offer adjustable scaffolding and optional deeper analysis. Have an instructor review historical accuracy; do not claim the current seed is a complete course.
**Done when:** Each published chapter states what students should understand, contains source-backed teaching, and assesses more than recall. Uncertain/disputed interpretations are labeled instead of presented as settled fact.

### 27 · P1 · M · Replace the mandatory heart lockout [Confirmed + Proposal]
**Evidence:** Five hearts, one regeneration every fifteen minutes, games blocked at zero, lesson completion refills all hearts. Re-completing a lesson can refill again. Mistakes can interrupt required coursework.
**Cursor fix:** Make core learning and teacher assignments unlimited. Use optional challenge lives only in clearly separate arcade sessions; use hints, retries, and review recommendations for learning. If hearts remain, document and implement their exact purpose rather than allowing a lesson-completion loophole to dictate behavior.
**Done when:** A student can always continue learning and complete required work after errors; challenge settings do not alter grades or access to explanations.

### 28 · P1 · M · Turn Practice into personalized review [Confirmed]
**Evidence:** `/practice` is a Game Lab of static sample boards with nothing saved. It is useful as a demo but not a real practice system.
**Cursor fix:** Move board demos to a clearly labeled Try games area. Build Practice from completed content, recent mistakes, and concepts due for review. Start with transparent scheduling rules and instructor tags rather than opaque AI adaptation. Show why an activity was recommended.
**Done when:** Two learners with different mistakes see different review sets; practice results save without incorrectly marking a formal assignment complete.

### 29 · P1 · M · Make profile statistics honest and course-wide [Confirmed]
**Evidence:** Profile fetches `/path/demo`; trophies are hardcoded to `childhood`. “On the path” depends on a current node and can disappear after full completion. Seed streak is 3 and no updating streak workflow was found.
**Cursor fix:** Aggregate across the user's modules; persist earned achievements or derive monotonic criteria. Track qualifying learning activity by a defined timezone/day policy, with Asia/Manila as the APC default. Explain XP and streak rules; remove statistics that are not yet implemented.
**Done when:** Finishing the course never revokes an earned badge; profile totals match actual history; midnight and replay cases behave consistently.

### 30 · P1 · M · Add a journal, bookmarks, and glossary [Proposal]
**Cursor fix:** Let learners save source excerpts, terms, and private reflections into a searchable journal linked to chapter context. Add book/character/place browsing and quick return links. Default notes to private; explicitly distinguish teacher-submitted reflections.
**Done when:** Students can find a bookmarked passage before an exam, reopen its source, and export their own notes without sharing private notes accidentally.

### 31 · P2 · M · Support language and reading preferences [Proposal]
**Cursor fix:** Add English/Filipino UI dictionaries and curated content translations, adjustable text size, narration/transcript support where licensed, and persistent sound/motion settings. Preserve original historical quotations alongside translations. Do not auto-translate assessment keys without editorial review.
**Done when:** Changing language preserves current progress and location; longer translated text fits controls; source wording remains distinguishable from explanation.

### 32 · P1 · M · Make keyboard, screen reader, and touch use complete [Confirmed gaps]
**Evidence:** `FieldLabel` produces standalone labels without `htmlFor`; color swatches lack accessible names; `WhySheet` focuses a dialog but has no focus trap/return handling; top-bar hearts/streak chips expose bare numbers. Existing tap placement and reduced-motion CSS are positives.
**Cursor fix:** Associate labels, name swatches, expose `aria-current`, add skip navigation and semantic feedback, and use accessible modal focus behavior. Make flipped memory content meaningfully announced. Test touch alternatives independently of keyboard support, and check contrast for every author-selectable color.
**Done when:** Complete the authoring and gameplay flows by keyboard and screen reader, with no hidden focus or color-only answers. Audit 200% zoom, narrow viewports, and touch targets. W3C explicitly distinguishes pointer alternatives from keyboard support: [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

### 33 · P1 · M · Use reliable loading, recovery, and empty states [Confirmed]
**Evidence:** Student errors include “Modules are napping” and tell learners to run `npm run dev:api`. Only teacher-specific error handling is present in the route inventory; no route loading files were found.
**Cursor fix:** Add route-appropriate loading and error boundaries, meaningful retries, empty states with available actions, and offline/unavailable distinctions. Keep infrastructure instructions in development diagnostics. Add breadcrumbs and consistent Back behavior across lesson, game, and studio screens.
**Done when:** A production outage gives a calm explanation and retry/support action; no student sees terminal commands; failures do not erase the current task.

### 34 · P2 · L · Add measured low-bandwidth resilience [Proposal]
**Cursor fix:** First optimize images, fonts, and critical routes and measure on a representative lower-end phone. Then add optional downloaded lesson packs and practice-only offline use with explicit account-scoped cache eviction. Keep assessed attempts online until their reconciliation model is proven.
**Done when:** Downloaded material is clearly labeled, removed on shared-device logout as appropriate, and never silently overwrites a newer content revision. Publish measured load/interaction results, not an unverified “fast” badge.

## Game feel and minigames

### 35 · P1 · M · Establish a consistent motion and sound system [Confirmed + Proposal]
**Evidence:** `globals.css` already has pulse, float, flip, snap, and celebration animations plus reduced-motion support. What is missing is a coherent transition/reward language, not animation itself.
**Cursor fix:** Define shared motion tokens: approximately 120–180ms controls, 180–280ms screen changes, and short skippable milestone sequences. Favor transform/opacity. Animate accepted placement, chapter unlock, artifact collection, and progress with consistent rules. Add opt-in sound with persistent mute; preserve reduced motion and Focus mode. Avoid perpetual pulsing on every element.
**Done when:** Transitions never delay input or obscure feedback; reduced-motion mode remains clear; rapid navigation cancels stale animations; animation performance is profiled on a representative phone.

### 36 · P1 · M · Rebuild quiz as “Evidence Duel” [Proposal]
**Keep:** The reusable quiz engine and explanations. **Change:** Present a historical claim and two or more sources; select the strongest evidence, then justify with a structured reason. Ordinary recall quizzes remain for quick checks, with shuffled stable choice IDs.
**Cursor fix:** Extend question data with stimulus/source references, rationale options, objective tags, and explicit assessment rules. Add feedback for correct answers too, not only misses. Use deterministic rubric scoring for structured responses; open reflections remain teacher-reviewed.
**Done when:** A five-question pilot distinguishes factual recall from evidence evaluation; answer position is not a clue; each feedback panel explains reasoning and links its source.

### 37 · P1 · M · Rebuild memory as “Archive Match” [Confirmed + Proposal]
**Evidence:** `memory-round.ts` grants eight seconds per pair and subtracts three seconds for mismatches. This conflates reading speed, memory, and historical understanding.
**Cursor fix:** Default to untimed matching of person/contribution, work/theme, and place/event; reveal a meaningful explanation and collect the matched artifact. Offer a separate timed challenge with adjustable timing. Add sufficient text/image alternatives and stable pair IDs.
**Done when:** The required learning version is fully playable without a timer; timed results are separate; users can understand why every pair belongs together. See [W3C Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).

### 38 · P1 · M · Upgrade timeline into “Cause and Consequence” [Proposal]
**Keep:** The gold rail, placement interaction, and tap alternative. **Change:** Follow ordering with one causal connection or contextual explanation. Avoid making visible year labels solve every challenge automatically.
**Cursor fix:** Add optional date hints, event groups for uncertain/simultaneous chronology, and teacher-authored causal links with explanations. Preserve strict ordering only for events with defensible order; do not force anecdotes into false precision.
**Done when:** One pilot asks learners to explain a connection after ordering; hint use is visible without preventing learning; ambiguous order is supported by content rules.

### 39 · P1 · M · Upgrade sorting into “Curator's Desk” [Proposal]
**Keep:** Buckets and place-then-check mechanics. **Change:** Sort evidence by primary/secondary source, literary theme, or reform strategy, then inspect the reasoning.
**Cursor fix:** Add optional justification choices and per-item sources. Allow an explicit “insufficient evidence” category where appropriate. Keep unambiguous answer sets for auto-scored versions and teacher rubrics for interpretive tasks.
**Done when:** Every category decision has an educational explanation; discussion questions are not falsely graded as a single objective answer.

### 40 · P1 · S · Reduce filler blanks; use “Restore the Passage” selectively [Proposal]
**Evidence:** Blank games use a sentence, one answer, and decoys. They are useful for vocabulary but can become repetitive recall padding.
**Cursor fix:** Retain cloze exercises for meaningful terms and short sourced passages; add context and distractor explanations. Validate duplicate answers/decoys and blank count. Replace low-value date/name repetition with another activity when it adds no objective coverage.
**Done when:** Every blank is connected to a stated learning objective and source; there is no ambiguity created solely by punctuation, accents, or duplicate choices.

### 41 · P2 · L · New flagship: “The Rizal Case Files” [Proposal]
**Loop:** Receive a historical question → inspect three to five documents/artifacts → annotate evidence → choose a defensible conclusion → see a sourced debrief. Example framing: examine how a selected text argues for reform, using instructor-approved excerpts.
**Cursor fix:** Build a document viewer, evidence tray, structured claim/evidence/reasoning submission, and rubric feedback. The teacher editor uses a reusable case template, source records, accepted evidence combinations, and debrief. Start with one authored case, not a procedural generator.
**Done when:** Students can solve a 5–10 minute case with mouse, touch, or keyboard; scoring rewards evidence use; every historical assertion traces to the curated source pack.

### 42 · P2 · L · New game: “Dispatches from Europe” [Proposal]
**Loop:** Explore a schematic route → open a letter/context card → connect an intellectual encounter to a work or idea → write/select a short dispatch. The map provides narrative context rather than testing geography trivia alone.
**Cursor fix:** Use a lightweight SVG map with an equivalent place list. Add authored stops, source excerpts, prompts, and unlock rules. Avoid precise animated travel routes when historical itinerary evidence is missing.
**Done when:** The whole activity works from the list without the map; each stop teaches an objective; external map services are unnecessary for the pilot.

### 43 · P2 · L · New game: “The Editorial Room” [Proposal]
**Loop:** Assemble an editorial from claims, evidence, counterarguments, and a conclusion; receive feedback on coherence and source use.
**Cursor fix:** Extend reusable placement primitives with argument slots and multiple accepted structures. Add teacher rubrics and a preview that explains scoring. Use a historical-context briefing so modern assumptions are discussed rather than silently treated as facts.
**Done when:** More than one defensible argument can succeed; weak evidence receives specific feedback; the game does not reward choosing a preferred political opinion.

### 44 · P2 · L · New game: “Dapitan Workshop” [Proposal]
**Loop:** Allocate limited project resources across an instructor-authored community scenario and explain tradeoffs. Reveal a historical debrief comparing the simulation with documented activity.
**Cursor fix:** Implement a small deterministic turn-based simulation with visible resources, reversible planning, scenario templates, and rubric prompts. Clearly label invented budgets and counterfactual choices as game assumptions. Avoid presenting a numeric “best Rizal decision” as historical truth.
**Done when:** Multiple strategies expose meaningful tradeoffs; every run ends in a sourced debrief; no twitch controls or mandatory timer excludes learners.

### 45 · P2 · M · Make chests into an artifact collection [Confirmed + Proposal]
**Evidence:** Chests currently supply a generic message; creation/editor support is limited to seeded chests. They provide a reward wrapper without much educational meaning.
**Cursor fix:** Replace empty rewards with a journal artifact: a map, source excerpt, work cover, or contextual illustration with provenance. Add a simple teacher reward editor and achievement criteria. Offer cosmetic journal covers through learning milestones without loot boxes or paywalls.
**Done when:** Every reward adds something revisitable and relevant; earned artifacts persist per user; repeat completion does not duplicate rewards.

### 46 · P2 · M · Add cooperative class challenges after core reliability [Proposal]
**Cursor fix:** Start with asynchronous class goals, such as a shared evidence collection, and teacher-moderated team cases. Prefer mastery/improvement recognition to public lifetime-XP rankings. Use aliases and opt-in display; defer chat and real-time multiplayer until there is a moderation and operational reason to add them.
**Done when:** Participation does not expose private grades or make slower students public losers; teachers can disable the feature; progress remains correct without simultaneous attendance.

## Remove, retain, and defer

**Remove or replace:** mandatory learning heart lockouts; fake/demo statistics outside demo mode; the universal Teacher studio door; developer terminal instructions in student errors; “kids-first” as the default positioning; raw Markdown as the only authoring option; generic placeholder publication; destructive default deletes; repetition that does not cover an objective.

**Retain and strengthen:** five reusable board engines; shared Zod validation; server-side content/progress boundaries; sanitized lesson rendering; playtesting; explanation feedback; mobile tabs; tap-to-place; reduced-motion support; SQLite/libSQL unless measured needs justify a database change.

**Defer:** full 3D/RPG engine, open chat, global leaderboards, real-time multiplayer, complex currencies, compulsory streak pressure, and unrestricted generative “Rizal chatbot.” A chatbot would add factual/provenance and moderation work before solving the main teaching problem. A future constrained source-search assistant should cite the curated corpus and admit missing evidence.

## Microsoft admission design

Your desired experience can work: **anyone can start Microsoft authentication; only eligible users receive a Jose session**. “Cancel login” means deny Jose admission, not sign the person out of Microsoft globally.

1. Register the app for the intended supported Microsoft account types. If literally any Microsoft account can start, include organizational and personal accounts and use the matching authority. Request minimal sign-in scopes; avoid directory-wide permissions. School policy may still prevent consent. Application-side filtering does not bypass that restriction. [Microsoft account types](https://learn.microsoft.com/en-us/entra/identity-platform/single-and-multi-tenant-apps), [identity and consent responsibility](https://learn.microsoft.com/en-us/security/zero-trust/develop/identity-supported-account-types).
2. Use a maintained OIDC integration with authorization code flow and PKCE; validate state, nonce, signature, issuer, audience, and expiry correctly for the configured account types. Keep callback secrets server-side. Do not implement JWT verification yourself or accept a browser-decoded email as proof.
3. Use a stable provider key, such as validated issuer+subject, for account identity. For organizational identities, validated tenant+object identifiers can support stable mapping. Never use an email address as the permanent account primary key. Microsoft explicitly warns against email-like claims for authorization. [Claims validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation), [ID token claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).
4. Treat the Microsoft email-like value only as a candidate admission address. If it is present and outside the exact allowed domains, reject with “Jose school accounts require an APC email. Switch Microsoft account.” If absent or ambiguous, require the user to supply and verify an APC mailbox before proceeding; this is a recovery branch, not automatic admission.
5. Independently verify the candidate APC mailbox using a short-lived, one-time code or link bound to the pending Microsoft identity, callback session, and requested address. Store only a hashed verifier; limit attempts, expiry, resend rate, and abuse. This extra step is needed because a plausible suffix is not evidence of mailbox control. For the strictest interpretation of your request, reject mismatching present Microsoft claims rather than allowing arbitrary linking to a different email.
6. Parse one valid mailbox, normalize the domain case, and compare exact domain equality against `apc.edu.ph` and `student.apc.edu.ph`. Reject lookalikes such as `apc.edu.ph.evil.test`, `fakeapc.edu.ph`, and other subdomains. Do not use `includes('apc.edu.ph')`, a loose suffix, or an HTML form field as the enforcement mechanism.
7. After both identity authentication and mailbox verification, create the application account/session in one controlled flow. Default role is student. Keep pending identities out of protected APIs. Reject account-link conflicts; never silently merge accounts by email alone. Log admission outcomes without logging tokens or codes.
8. Use Secure, HttpOnly session cookies, CSRF protection appropriate to the deployment, session rotation and expiry, and explicit logout. Prefer a same-origin browser/BFF setup; if cross-origin cookies are necessary, deliberately configure credentials, exact origins, and cookie policy. Server components must forward the correct session to protected API requests.
9. Reverify when the admission address changes and support admin suspension. Periodic mailbox verification can reconfirm mailbox access, but domain possession alone does not prove current enrollment or instructor status. Enrollment/teacher rights remain app-managed policies.
10. If school policy blocks Microsoft consent, offer a separately implemented APC email-code login with the same admission rules. This is a fallback authentication option, not a promise that Microsoft can be made to ignore school policy. No actual verification emails were sent during this review.

Required tests: allowed staff-domain learner; allowed student-domain learner; outsider; uppercase domain; misleading suffix; malformed address; missing claim; conflicting claim; expired/replayed verification; incorrect code and retry limit; wrong token issuer/audience; callback CSRF; two concurrent callbacks; existing-account linking conflict; logout; revoked session; student hitting teacher endpoints; consent denied/cancelled. Test real school consent behavior in staging when credentials and app registration are available.

## Recommended delivery order

**Batch A — school-safe foundation:** 01–06, 08–10, 19, and critical tests from 13. Identity, admission, permissions, visibility, revisions, and progress integrity are prerequisites for real student data.

**Batch B — dependable authoring:** 07, 14–18, 20–21, 32–33, plus observability from 11. Run a teacher usability session before expanding content. Build one excellent end-to-end module workflow.

**Batch C — flagship chapter:** 23–29 and 35–40, with sourced content from 26. Choose one chapter and demonstrate the complete investigation loop, then decide whether the pattern should spread.

**Batch D — classroom operations:** 12–13, 22, 30–31, and measured performance work from 34. Treat accessibility and reliability as ongoing acceptance criteria, not a final polish phase.

**Batch E — expansion:** Pilot 41 first. Add 42–46 only when their authoring cost and learner value are demonstrated. Do not build all new games simultaneously.

## Proposed pilot and success measures

These are proposed targets; no baseline was measured during this review. Observe approximately five instructors/content authors and eight to twelve learners, mainly college RIZLIFE students with some younger participants. Use appropriate institutional arrangements for involving minors.

- Teacher task: create a sourced lesson and five-question activity, preview, correct an error, publish. Record time, help requests, lost edits, and publish errors. Aim for a prepared-content first draft in under ten minutes, then revise the target using the baseline.
- Student task: return to an interrupted lesson, complete a chapter, recover from a failed save, and find a source afterward. Aim for one-action resume and zero lost submissions in the tested interruption scenarios.
- Learning: compare a short objective-aligned pre-check, post-check, and delayed check. Track explanation quality and misconceptions, not just clicks, XP, or time spent.
- Engagement: ask whether the activity felt worthwhile and whether students voluntarily chose another activity. Longer session time alone is not evidence of success.
- Operations: measure save failure rate, unauthorized request rejection, query latency, and restore success under a stated test workload. Set service targets after establishing an actual deployment baseline.

## Copy/paste master prompt for Cursor Grok 5.6

```text
Read docs/reviews/2026-09-05-application-review.md and all applicable AGENTS.md files. Implement only Batch [A/B/C/D/E], tickets [IDs], on an isolated branch. Treat this review as recommendations and acceptance criteria, not proof every suggested implementation detail is already correct.

First inspect the current code and explain the concrete changes, dependencies, and any contradictions. Preserve the existing Next.js/NestJS/libSQL/shared-Zod architecture unless evidence requires a change. Read the installed Next.js documentation as required by apps/web/AGENTS.md. Reuse the current game engines and existing accessibility features.

For each ticket, implement the smallest complete vertical slice, include database migrations where needed, and add meaningful regression tests for its stated Done when cases. Do not trust client identities, scores, or email claims; do not merge accounts by email; never grant teacher permissions from a domain suffix. Use the Microsoft admission design for ticket 03 and state any required external app-registration or consent setup without claiming it is already configured.

Keep demo data separate. Preserve historical attempts and published content revisions. Do not overwrite unrelated working-tree changes, mass-upgrade dependencies, introduce fake statistics, publish content, send emails to real people, or deploy without task-specific authorization. Use a test mail transport during development.

Validate a clean install/build/typecheck/lint/test workflow and the relevant browser flows at phone and desktop sizes. Verify keyboard operation, reduced motion, failure recovery, and authorization. Report exact checks and limitations; do not claim unrun tests passed. Deliver a concise summary, changed files, migration/rollback instructions, and remaining external setup. Stop at the chosen batch boundary.
```

For the fastest useful start, select tickets 01, 02, 03, 04, and 06 as the first foundation slice, while explicitly designing their interfaces with 05 and 19 so attempts and content revisions do not require avoidable rework.

## Review scope and verification

Inspected the API controllers/service, database schema/bootstrap/seed routines, shared game/progress/teacher contracts, route layout, student navigation/profile/practice, teacher editors, game players, scoring helpers, CSS, test inventory, package scripts, recent commits, and existing future-work design. Microsoft identity guidance and W3C interaction guidance were checked against primary sources linked above.

Runtime validation results are recorded in the companion verification note. Source findings are differentiated from proposed changes. This review does not establish accessibility conformance, production performance, actual APC consent policy, or historical accuracy of the full curriculum. No application source changes or deployments are part of this review.
