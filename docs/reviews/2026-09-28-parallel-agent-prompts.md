# Parallel agent prompts

Run these **after #81 is merged to `main`**. Start all six cloud agents in the same turn. Each one branches from that `main`. They do not wait on each other.

Give every agent **Grok 4.7 High Fast**. Paste one prompt per agent. Do not merge two prompts into one agent.

## Why they can run together

Each prompt owns a different file list. An agent must not edit a file it does not own, even if that would be convenient. Shared behavior is a JSON shape, not a shared function:

- Badge, XP, and streak fields are **optional**. Old responses still parse.
- UI that wants those fields reads them with a local cast. If they are missing, that UI does nothing new and the screen still works.
- Zod drops unknown keys. The agent who owns `packages/shared` is the one who adds the optional keys so they survive parsing. The UI agents do not add those keys themselves.

You do **not** need a second wave. Merge the six PRs in any order. When the badges PR and the session PR are both on `main`, the completion screen starts showing a badge. When the badges PR and the home PR are both on `main`, the daily-goal ring appears. Until then those extras stay hidden.

If two PRs conflict, someone edited a file outside their list. Keep the copy from the agent who owns that file.

## Do not give these files to more than one agent

| Files | Only this agent |
| --- | --- |
| `apps/api/**`, `packages/shared/**`, `apps/web/src/lib/path-api.ts`, `profile-showcase.tsx` | 1. Badges |
| `lesson-player.tsx`, `chest-player.tsx`, `game-player.tsx`, `apps/web/src/components/games/**` | 2. Session |
| `jose-shell.tsx`, `learning-shell.tsx` | 3. Shell |
| `path-view.tsx`, `level-node.tsx`, `apps/web/src/app/globals.css` | 4. Path |
| `module-grid.tsx`, `continue-learning-card.tsx`, `status-hud.tsx`, `top-bar.tsx`, `apps/web/src/app/learn/page.tsx` | 5. Home |
| `practice-hub.tsx` | 6. Practice |

Nobody edits the landing page: `apps/web/src/app/page.tsx`, `apps/web/src/app/login/**`, `apps/web/src/components/landing-page.tsx`, `apps/web/src/lib/landing-gate.ts`.

---

## Prompt 1 — Permanent module badges

```text
You are Grok 4.7 High Fast working in the Jose repo (apps/web Next.js, apps/api NestJS, packages/shared). Branch from main. Main already has the public landing page and docs/reviews/2026-09-28-mobile-ux-and-module-badges.md. Follow that doc’s “P0 — Permanent module badges” and the XP/streak notes below. Do not restyle the pixel-art UI.

Other agents are editing the lesson player, game player, shells, path, home, and practice at the same time. If you need a component they own, stop. Do not create it in their files.

YOU MAY EDIT ONLY:
- apps/api/src/db/schema.ts
- apps/api/src/db/migrations/index.ts (append migration 017 only; do not rewrite older migrations)
- a new migration block in that same file
- apps/api/src/db/backup.ts and apps/api/src/db/empty.ts only to include the new table name in existing lists
- apps/api/src/curriculum/curriculum.service.ts
- a new test file apps/api/src/curriculum/module-badges.spec.ts
- packages/shared/src/profile-stats.ts and profile-stats.test.ts
- packages/shared/src/streak.ts and streak.test.ts only for the XP sentence
- packages/shared/src/modules.ts (attemptResultSchema only)
- packages/shared/src/assessment.ts (finishAttemptResultSchema only)
- packages/shared/src/index.ts only if a new export is required
- apps/web/src/lib/path-api.ts only so the existing parsers keep the new optional fields
- apps/web/src/components/profile-showcase.tsx and profile-showcase.test.tsx

DO NOT EDIT globals.css, jose-shell, learning-shell, lesson-player, chest-player, game-player, games/*, path-view, level-node, module-grid, status-hud, practice-hub, or the landing page.

Implement learner_module_badges exactly as the review doc specifies:
- Snapshot title, subtitle, cover color, revision id, level count, earned_at.
- No foreign key to modules. Unpublish, archive, or a later revision must not delete or rewrite the row.
- Award inside the same transaction as the learner_progress insert in markComplete, which both lesson complete and game finish already use.
- Award only when every level id in the published snapshot the student just played is in learner_progress. Zero-level modules never award.
- ON CONFLICT DO NOTHING. Never overwrite earned_at or the original snapshot.
- Backfill from historical module_revisions: if every level id in a published snapshot is complete, insert once, using the earliest such completion time.
- getProfileStats and achievementEvidence must count student progress from the published snapshot, not the live draft. Batch the per-module queries with the existing helpers. Do not add a query per section inside a loop.
- course-complete stays monotonic in learner_achievements.

Add these OPTIONAL response fields. Missing fields must still parse. Do not make them required.

moduleBadge (nullable object or null) on attemptResultSchema and finishAttemptResultSchema:
  moduleId, title, subtitle, coverColor, levelCount, earnedAt, publishedRevisionId, stillPublished
Set it only on the response that first inserts the badge. Later completions send null.
Also optional on those two schemas: xpAwarded (number), streakIncreased (boolean).
xpAwarded is 10 on first completion. A passing replay awards 5 when UNLIMITED_LEARNING is false, and 0 otherwise. Practice reviews award 0. streakIncreased is true only when the Asia/Manila streak count actually goes up.
Update XP_RULES_COPY so it matches that behavior. Today the copy says replays award nothing, and finishAttempt adds another 10.

ProfileStatsResponse.badges is an array of the same badge object, newest earnedAt first. Use .default([]) so older payloads still parse.
Learner objects used by students gain optional dailyGoal: { met: boolean, completedLevelsToday: number, targetLevels: 1 }. met is true when completedLevelsToday >= 1, counted from learner_progress.completed_at in Asia/Manila. Do not add a client-writable counter.

Profile UI in profile-showcase.tsx:
- The completed shelf reads stats.badges, not “completedCount >= totalCount”.
- A badge with stillPublished true links to /learn/{moduleId}. A badge with stillPublished false stays on the shelf, labeled Retired module, with no path link.
- Show earned date and snapshot title. Empty shelf copy stays inviting.
- Under the earned shelf, show locked rows for published modules that have no badge yet, with completed/total from the published snapshot.
- Show all four global achievements, locked ones dimmed, earned ones with earnedAt. Do not remove them.
- Replace the hardcoded warrior image with the learner’s chosen avatar. Keep the emblem only if it still matches that avatar.
- The profile test looks up “Edit profile”; the button text is “Edit Profile”. Update the test to the visible label if it fails.

Tests must prove: first finish inserts one badge and returns it; replay does not change earned_at; a new revision with an extra level does not delete it; unpublish leaves it and stillPublished is false; a second learner does not receive it; zero levels do not award; backfill awards a fully completed historical revision and skips a partial one.

Run the API module-badges spec, the shared profile-stats and streak tests, and the profile-showcase test. Mobile check the profile at 360px and 320px.
```

---

## Prompt 2 — Level session

```text
You are Grok 4.7 High Fast working in the Jose repo. Branch from main. Main has the landing page and docs/reviews/2026-09-28-mobile-ux-and-module-badges.md. Read the sections “P0 — Mobile session loop” and “P1 — Make the loop feel like a daily practice app” items 2, 4, and the completion moment. Keep the pixel-art look. Do not chop lesson prose into one-sentence cards.

Other agents are editing shells, path, home, practice, the API, and shared schemas at the same time. Do not edit their files. Do not add fields to Zod schemas. If a field is not on the type yet, read it with a cast. If it is missing at runtime, skip that beat. The screen must still finish the lesson or game.

YOU MAY EDIT ONLY:
- apps/web/src/components/lesson-player.tsx
- apps/web/src/components/chest-player.tsx
- apps/web/src/components/game-player.tsx
- apps/web/src/components/games/** (play UI and their tests)
- a new CSS file imported only by those components, for example apps/web/src/components/session-play.css

DO NOT EDIT globals.css, jose-shell, learning-shell, path-api.ts, packages/shared, apps/api, profile-showcase, path-view, module-grid, or the landing page. Another agent hides the bottom nav on a level route. You only own the play screen.

Do this:
- Lessons: remove the always-on ExplanationNote and SourceQuote placeholders. Render those blocks only when the lesson has a real explanation or source. Put one full-width Continue (or “Saving…”) in a bar fixed to the bottom of the play column, above env(safe-area-inset-bottom), visible without scrolling to the end of a long article. “Back to map” stays a header text button, not a second primary button.
- Games: GameFrame already accepts progress and nothing passes it. Quiz, sort, blank, timeline, and memory must show “Question 2 of 5” or the matching equivalent, plus a thick progress bar under the session header. Memory can keep “pairs matched”.
- The why sheet stays a bottom sheet on a phone, above the safe area, and still traps focus. A wrong answer stays on the same question. Do not reveal a correct choice in a way that skips the server grade.
- StarCelebration: on viewports under 640px the actions stack full width and sit above the safe area.
- After a successful lesson, chest, or game save, read the completion JSON with a cast:
  moduleBadge?: { title: string } | null
  xpAwarded?: number
  streakIncreased?: boolean
  If moduleBadge.title is a non-empty string, show one short beat before continue: “Module badge earned” and that title. If xpAwarded is a positive number, show “+N XP”. If streakIncreased is true, show the new streak from result.learner.streak once. If those fields are absent, skip the beat and continue exactly as today.
- Do not call a badge function from @jose/shared. The other agent may not have added one.

Run the existing game and lesson tests you touch. Check a lesson and a quiz at 360px and 320px: Continue is reachable with the thumb, and the progress bar is visible on question 1.
```

---

## Prompt 3 — Mobile shell

```text
You are Grok 4.7 High Fast working in the Jose repo. Branch from main. Keep the pixel-art nav images. Do not restyle them into a different brand.

Other agents are editing the lesson player, games, path, home, practice, API, and profile at the same time. Do not edit their files.

YOU MAY EDIT ONLY:
- apps/web/src/components/jose-shell.tsx
- apps/web/src/components/learning-shell.tsx
- apps/web/src/components/learning-shell.test.tsx
- a new CSS file imported only by the shell, for example apps/web/src/components/shell-nav.css

DO NOT EDIT globals.css, lesson-player, game-player, games/*, path-view, profile-showcase, module-grid, path-api, packages/shared, apps/api, or the landing page.

Do this, mobile first (360px, then 320px):
- On a level route matching /learn/{moduleId}/{levelId}, do not render the bottom nav. The play screen needs the thumb zone. Restore the nav on every other student route. Desktop sidebar can stay.
- Every bottom-nav item needs a visible text label under its image. aria-label is not enough. Labels come from the existing tab.label. At 320px, four labels plus images must fit without horizontal scroll.
- Settings (/profile/preferences) is only in the desktop sidebar today. Add it to the mobile bottom nav as a labeled item, or as a labeled row directly above the nav that is always visible. Do not hide it inside profile.
- If a teacher “Teacher area” tab makes five items overflow at 320px, remove it from the student tab bar. Put one labeled text link “Teacher area” in the shell, visible only when canTeach is true, and not as a fifth icon. Do not add that link to profile-showcase; you do not own that file.
- The streak number is already on useJoseSession().learner.streak. On Practice, Bookmarks, and Profile, show a compact streak chip in the shell header using that value. On /learn the existing top bar already shows streak; do not stack a second full XP/lives HUD. If learner is null, omit the chip.
- Touch targets stay at least 44px. The nav must clear env(safe-area-inset-bottom).

Update learning-shell tests for the label text and for the level route hiding the bottom nav. Use a mocked pathname. Do not require a new shared helper.
```

---

## Prompt 4 — Path on a phone

```text
You are Grok 4.7 High Fast working in the Jose repo. Branch from main. Read “P0 — Path map on a phone” in docs/reviews/2026-09-28-mobile-ux-and-module-badges.md. Keep the landmass art and the map. You are the only agent allowed to edit globals.css. Change only path rules. Do not reformat the file or change unrelated selectors.

YOU MAY EDIT ONLY:
- apps/web/src/components/path-view.tsx
- apps/web/src/components/level-node.tsx
- apps/web/src/components/level-node.test.tsx
- apps/web/src/app/globals.css, and only selectors that affect .path-section, .path-node-label, and the path toolbar button size

DO NOT EDIT shells, lesson or game players, profile, home, practice, API, packages/shared, or the landing page.

The page scrolls inside .jose-shell-main. html and body use overflow hidden, so window.scrollY is always 0.
- Save and restore scrollTop on .jose-shell-main for the path, keyed by module id as today. On first open with no saved position, scroll the current node into the center of that element.
- IntersectionObserver root must be .jose-shell-main, not the viewport.
- Chapter picker and “Current” may keep scrollIntoView.
- Under 768px, .path-section must size to its content. Remove the 100dvh minimum on small screens so a two-node chapter is not a blank phone screen. Desktop may keep the taller chapters. Keep the landmass visible.
- Current, map, and list controls must be at least 44px tall and wide.
- Node titles: the JSX max-w-[10.5rem] fights the mobile clamp. On viewports under 768px the clamp must win, titles may use two lines, and a left-lane title must not cover a right-lane title at 320px (lanes are 28 / 50 / 72). If they still collide, increase the vertical row gap on small screens only. Do not drop titles.

List view stays one tap away. Add or adjust a test that the scroll container used is not window. Check the path at 360px and 320px.
```

---

## Prompt 5 — Home and status HUD

```text
You are Grok 4.7 High Fast working in the Jose repo. Branch from main. Keep the wooden HUD panels and book covers. Do not restyle them.

Other agents own badges, the API, shells, the path, and practice. Do not edit their files. Do not add Zod fields. A daily goal and badge chip may be absent. When they are absent, hide them. The home screen must still show Continue and the module books.

YOU MAY EDIT ONLY:
- apps/web/src/components/module-grid.tsx
- apps/web/src/components/continue-learning-card.tsx
- apps/web/src/components/status-hud.tsx
- apps/web/src/components/status-hud.test.tsx
- apps/web/src/components/top-bar.tsx
- apps/web/src/app/learn/page.tsx, and only to pass the existing learner object into the home components. Do not change the 401 redirect to the landing page or the class panel.
- a new CSS file imported by the HUD or home components, for example apps/web/src/components/home-mobile.css

DO NOT EDIT globals.css. Override the narrow HUD there from your new CSS file.

Do this at 360px, then 320px:
- Continue learning is the hero. On a phone the button is full width under the title, not beside it. If there is no continue action and there is at least one module, the first module is the hero with “Start here”.
- Status HUD: three panels stay on one row at 320px. XP is currently one image per character, so “120 XP” overflows a half-width panel, and under 480px the three panels wrap to two columns. Keep three columns. If the glyph string would overflow, draw the number as text on the wooden panel instead of per-character images. Lives must not drop onto their own row.
- Daily goal: the learner object may grow an optional dailyGoal { met, completedLevelsToday, targetLevels }. Read it with a cast from the learner prop. If it is missing, render nothing. If it is present, show a compact ring on the home hero: “Today’s goal” and either done or “0 of 1”. Do not invent a client counter and do not POST anything.
- Module cards keep their visible title and percent. If a module object has optional badgeEarned === true, show a small “Badge” label. If the field is missing, show the card exactly as today. Do not fetch a new endpoint.

Update the status HUD test so  the three stats remain available by their aria labels. Check the home header at 320px: XP, streak, and lives are all readable on one row.
```

---

## Prompt 6 — Practice inbox

```text
You are Grok 4.7 High Fast working in the Jose repo. Branch from main. Keep the current practice copy and the ungraded game lab. Do not restyle it.

YOU MAY EDIT ONLY:
- apps/web/src/components/practice-hub.tsx
- a new test apps/web/src/components/practice-hub.test.tsx if you need one

DO NOT EDIT globals.css, shells, games, path, home, profile, API, packages/shared, or the landing page. Do not import a helper another agent might add. Use the PracticeReviewResponse already passed into PracticeHub.

Make the review set a phone inbox:
- Show at most three review cards by default. If there are more, a full-width “See all” button reveals the rest. Due or weakest items should be first if the payload already has an order; do not re-sort in a way that needs a new field. If you cannot tell which are due, keep the server order and still cap the default at three.
- Each card is one tap target of at least 44px, full width on a phone.
- The game lab stays below the review set and remains clearly ungraded. On a 700px-tall phone the first review card, or the empty state, must be on screen without the lab pushing it away. Move the long “Why these activities?” details below the lab or keep it collapsed.

Empty state stays the server’s emptyMessage. Add a test that four items render three cards plus “See all”, and that activating “See all” shows the fourth.
```
