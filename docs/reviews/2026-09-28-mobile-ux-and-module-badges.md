# Jose mobile UX and permanent module badges

**Reviewed:** 28 September 2026  
**Audience:** follow-up cloud agents (Grok 4.7 High Fast). Implement these batches. Do not restyle the pixel-art Jose look into a Duolingo clone.  
**Priority:** student UI/UX first, mobile first (design and test at 360×740, then 320×700 and a desktop check). Backend work exists to make that UX true and permanent.

## What is already good

Keep this foundation. Do not replace it.

- Next.js student app, NestJS API, shared Zod contracts, libSQL migrations, cookie sessions, per-account learner rows.
- Hearts, streak (Asia/Manila), and 10 XP on first completion of a path level (`FIRST_COMPLETE_XP` in `curriculum.service.ts`).
- Server-graded attempts, idempotent misses, local attempt drafts when save fails.
- Path nodes with locked / current / completed, list mode, chapter picker, “Current” jump.
- Game feedback sounds, why-sheet, and a star celebration (`StarCelebration`).
- Four monotonic course achievements in `learner_achievements`, awarded by `syncAchievements` and never revoked.
- Profile “Completed Books” shelf, adventure log, avatar emblem, reading preferences.
- Bottom nav already uses `env(safe-area-inset-bottom)`. Minimum control height is often 44px. Main scroll container is `.jose-shell-main` because `html, body` do not scroll.

## Product rule for every batch

Mobile is the primary layout. Desktop is the wide version of the same screen.

- Primary action sits in the thumb zone: a full-width button fixed to the bottom, above the safe area.
- During an active lesson, game, or chest, the student shell’s bottom nav is hidden. The session owns the screen. Restore the nav when the student leaves the level.
- Nothing important may depend on hover.
- Touch targets stay at least 44×44px, including chapter toolbar icons and map/list toggles.
- Scroll, restore, and “jump to current” must use `.jose-shell-main`, not `window`. `window.scrollY` is always 0.
- Do not introduce a second palette, typeface, or another product’s branding. Duolingo is the interaction model (one obvious next step, visible progress, celebration, permanent rewards), not the visual source.
- Scholarly lessons stay readable articles. Do not chop lesson markdown into one-sentence cards. Games and chests should feel like a short session.

## P0 — Permanent module badges

This is the feature the profile is missing. Today “Completed Books” is derived in the browser from live progress:

```38:40:apps/web/src/components/profile-showcase.tsx
  const completedBooks = stats.modules
    .map((module, index) => ({ module, cover: moduleBookImage(index) }))
    .filter(({ module }) => module.totalCount > 0 && module.completedCount >= module.totalCount);
```

`getProfileStats` counts **live draft** levels via `orderedLevelIds`, while the student path uses the **published snapshot** (`buildStudentPath`). A teacher can add a level, unpublish a module, or edit a draft and the book disappears. `learner_achievements` only stores four global ids (`on-the-path`, `first-treasure`, `first-chapter-clear`, `course-complete`). There is no per-module badge row.

### Data model

Add a migration. Do not edit old migrations.

```text
learner_module_badges
  learner_id            TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE
  module_id             TEXT NOT NULL
  title_snapshot        TEXT NOT NULL
  subtitle_snapshot     TEXT NOT NULL
  cover_color_snapshot  TEXT NOT NULL
  published_revision_id TEXT
  level_count           INTEGER NOT NULL
  earned_at             INTEGER NOT NULL
  PRIMARY KEY (learner_id, module_id)
```

- No foreign key to `modules`. Archiving, unpublishing, or deleting a module must not delete the badge. The snapshot fields are what the profile renders forever.
- One badge per learner per module. The first time they clear a published revision, the row is inserted with `ON CONFLICT DO NOTHING`. Later revisions never revoke it and never overwrite `earned_at` or the original title snapshot.
- A module with zero levels never awards a badge.
- Badge award runs inside the same database transaction as the `learner_progress` insert in `markComplete` / `finishAttempt`. Do not award it in a later request that can be skipped if the process stops.
- Award condition: every level id in the **published snapshot the student just played** is present in `learner_progress` for that learner. Use that snapshot’s module title, subtitle, cover color, revision id, and level count.
- Do not use the live draft outline.

### Backfill

In the same migration or a one-shot service called from it:

For each learner and each row in `module_revisions` that was published, if every level id in that revision’s snapshot is in `learner_progress`, insert a badge if that learner+module has none. `earned_at` is the max `completed_at` among those level rows. If several revisions qualify, keep the earliest such `earned_at` and the snapshot from that revision.

This preserves a student who finished revision 1 after a teacher published extra levels in revision 2.

### API

Extend `profileStatsResponseSchema` in `packages/shared/src/profile-stats.ts`:

```ts
moduleBadgeSchema = {
  moduleId: string
  title: string          // snapshot
  subtitle: string
  coverColor: string
  levelCount: number
  earnedAt: number       // unix ms
  publishedRevisionId: string | null
  stillPublished: boolean // true only if this module id is currently published and not archived/trashed
}
```

`ProfileStatsResponse.badges` is this array, newest `earnedAt` first.

Also return the badge from the completion payloads (`completeLevel` and attempt finish) when this completion is the one that inserted it:

```ts
moduleBadge: ModuleBadge | null
xpAwarded: number          // 10 or 0
streakIncreased: boolean
```

`syncAchievements` stays as it is for the four global achievements. Module badges are a separate table. Do not overload `achievementIdSchema` with one id per module; module ids are not a fixed enum.

`GET /profile/stats` is the only student read. Do not add a client-writable badge endpoint.

### Profile UI

Replace the derived “Completed Books” shelf with `stats.badges`.

- Earned badges stay on the shelf even when `stillPublished` is false. Label those “Retired module” and do not link to a dead path. Published ones still link to `/learn/{moduleId}`.
- Show the snapshot title, a medal/book treatment using the existing book-cover art or the module cover color, and the earned date.
- Empty state stays: “Finish every level in a module to add its badge.”
- Also show a badge wall of **locked** badges for published modules the learner has not finished, with `completedCount/totalCount` from the published snapshot (not the draft). Locked badges are not stored. Earned badges are.
- The adventure log may mention the newest badge, but the shelf is the permanent record. Do not cap the shelf at two items.
- The hardcoded warrior `<img src="/assets/ui/profile/warrior-avatar.png">` must show the learner’s chosen avatar, not a fixed image with a tiny emblem on top.

### Completion moment

When `moduleBadge` is non-null, the lesson, game, and chest completion screen shows the badge before the next level: title, “Module badge earned”, and one Continue button. This is the Duolingo-style reward beat. It must work at 360px with the bottom nav hidden.

### Tests

- Finishing the last level of a published snapshot inserts one badge and returns it on the completion payload and on `GET /profile/stats`.
- Replaying that level does not change `earned_at` or the snapshot.
- Publishing a new revision with an extra level does not delete the badge.
- Unpublishing or archiving the module does not delete the badge; `stillPublished` becomes false.
- A second learner does not receive the first learner’s badge.
- A module with no levels does not award a badge.
- Backfill awards a badge when historical revision levels are all complete, and does not award one when any snapshot level is missing.
- Profile UI test: earned badge renders from `stats.badges` when `completedCount < totalCount` on the live module (the regression this feature exists to prevent).

## P0 — Mobile session loop

Files: `lesson-player.tsx`, `game-player.tsx`, `chest-player.tsx`, `games/game-stage.tsx`, `games/quiz-game.tsx`, `learn/[moduleId]/[levelId]/page.tsx`, `jose-shell.tsx`, `learning-shell.tsx`, `globals.css`.

1. **Hide bottom nav on a level route** (`/learn/:moduleId/:levelId`). Pass a prop into `JoseShell` or detect the pathname. The fixed nav plus `.jose-shell-main { padding-bottom: 5.5rem }` currently steals the thumb zone from Continue.
2. **Sticky session footer** for lessons: one full-width Continue (or “Saving…”), safe-area padding, visible without scrolling to the end of a long article. Keep “Back to map” as a text button in the header, not a second competing primary. Remove the always-on placeholder blocks in `LessonPlayer` (the hardcoded `ExplanationNote` and `SourceQuote` about future quotations). Render those components only when the lesson has a real source or explanation.
3. **Game progress.** `GameFrame` accepts `progress` and no game passes it. Quiz, sort, blank, timeline, and memory must show “Question 2 of 5” (or pairs matched) plus a thick bar under the session header. The bar is the first thing under the status row on a phone.
4. **Header during play:** close/back, progress bar, lives. Drop the separate “Unlimited learning / Lives N” line that wraps beside “Back to path” on a narrow screen. Lives already have `HeartsHud`.
5. **After the last question,** keep `StarCelebration`, and if `moduleBadge` is set, show the badge beat before navigating. Continue is full width on viewports under 640px (the celebration actions are a row from `sm:` up; on a phone they must stack and stay above the safe area).
6. **Map/list toggles and the Current button** in `path-view.tsx` use `p-2` / `py-2` and land under 44px. Make them `min-h-11 min-w-11`.

## P0 — Path map on a phone

Files: `path-view.tsx`, `level-node.tsx`, `globals.css` (`.path-section`).

1. **Scroll memory is broken.** `path-view.tsx` saves and restores `window.scrollY`. The page scrolls inside `.jose-shell-main`. Save and restore that element’s `scrollTop`. `scrollIntoView` can stay for “Current” and the chapter picker, but the observer `root` must be `.jose-shell-main`, not the viewport (`root: null`). On open, if there is no saved scroll position, scroll the current node into the center of `.jose-shell-main`.
2. **Each `.path-section` is `min-height: 100dvh`.** A two-node chapter still consumes a full phone screen of landmass, so the path feels sparse and the Current button is doing work the layout should not require. On viewports under 768px, size the section to its content (keep the landmass as a repeating or contained background). Desktop may keep the taller chapters.
3. **Node titles.** JSX sets `max-w-[10.5rem]` while the mobile CSS clamp is `clamp(4.5rem, 25vw, 9rem)`. Make the narrow clamp win, allow two lines, and verify at 320px that a left-lane title does not cover a right-lane title (`PATH_LANE_X` is 28 / 50 / 72). If they still collide, increase `ROW_PX` on small screens. Do not remove titles; icon-only nodes fail the course.
4. **Default mobile layout** may stay on the map if the checks above pass. List view remains one tap away and must stay.

## P0 — Home and status on a phone

Files: `module-grid.tsx`, `continue-learning-card.tsx`, `status-hud.tsx`, `globals.css` (`.jose-status-hud`), `learning-shell.tsx`.

1. **One primary action.** `ContinueLearningCard` is the home hero. On a phone the button is full width under the title, not a side column. If the learner has no progress, the first incomplete featured module is the hero (“Start here”), not a grid of equal books.
2. **Module cards** need a visible title (already in `.module-progress-label`) and a badge chip when `stats` or the module payload says a badge is earned. `GET /modules` should include `badgeEarned: boolean` so the grid does not need a second profile fetch. Progress percent stays, and it must be computed from the published snapshot, same as the path.
3. **Status HUD at 320px.** Under 480px the three panels become a 2-column grid, so lives wrap onto their own row, and XP is painted as one image per character (`120 XP` is six glyphs inside a box from 43% to 84% of the panel). Keep three columns at every width. Render the number as text over the wooden panel when the glyph string would overflow. The HUD must not cover the Jose wordmark or wrap the top bar to two scrolling rows.
4. **Streak and XP stay visible** on Learn. Practice, Bookmarks, and Profile may keep their own headers, but a phone user should still see streak without opening Profile. A compact streak chip in the shell header is enough; do not duplicate the full three-panel HUD on every tab.
5. **Settings is desktop-only.** The preferences link is in the sidebar footer, and the sidebar is `hidden` below `md`. Add Settings to the mobile bottom nav or as a clearly labeled row that is always reachable from Profile without opening a `<details>`. Do not add a fifth mystery image with no text. Nav items need a visible text label under the image at mobile sizes; `aria-label` is not enough for sighted students. If a teacher tab makes five items overflow at 320px, move “Teacher area” into Profile (admins and teachers only) instead of the student tab bar.

## P1 — Make the loop feel like a daily practice app

Still Jose visuals. These are the functional gaps versus a Duolingo session.

1. **Daily goal, Manila calendar, same zone as streaks.** Goal: complete one path level today, or earn 20 XP today. Derive it from `learner_progress.completed_at` and the XP rules. Do not add a client-writable counter. Home shows a ring: “Today’s goal” done or not. Completing the goal is a small beat on the celebration screen, not a new page.
2. **Streak beat.** Surface `streakIncreased` from the completion payload. If it is true, the celebration says the new streak count once. Do not celebrate on replay the same Manila day.
3. **XP copy is wrong.** `XP_RULES_COPY` says replays do not award path XP. `finishAttempt` adds another 10 XP on a replayed win when `UNLIMITED_LEARNING` is false. Pick one behavior and make the copy, the profile help text, and the code match. Preferred: keep first-completion XP at 10, and award a smaller replay XP (for example 5) only for a passing replay, stated in the copy. Practice reviews still award no path XP and do not complete assignments.
4. **Quiz answer rhythm.** A wrong answer already opens the why sheet. On a phone that sheet must be a bottom sheet (it already anchors to the bottom) that does not sit under the browser chrome or the safe area, and the next question’s progress bar must update before the student taps Got it only if the answer was accepted. Wrong answers stay on the same question. Do not reveal the correct choice in a way that skips the server grade.
5. **Practice is a mistake inbox, not a second home.** `PracticeHub` is fine as a list. Sort due reviews first, show at most three as the default with “See all”, and make each card one thumb target. The game lab stays below, clearly labeled as ungraded. Do not let the lab push the review set below the first screen on a phone.
6. **Global achievements stay.** Show all four on the profile, locked ones dimmed, earned ones with `earnedAt`. They are not a substitute for module badges.

## P1 — Backend correctness tied to the UX

Do this in the badge batch so agents do not “fix” the profile by caching the wrong numbers.

1. **`getProfileStats` and `achievementEvidence` walk every module, section, and level in nested queries** (`curriculum.service.ts` around `getProfileStats` and `achievementEvidence`). Batch with the existing `orderedLevelIdsByModules` / `levelsBySectionIds` helpers. Profile must stay fast on a phone network.
2. **Student-facing counts use the published snapshot**, including module grid `completedCount` / `totalCount`, profile in-progress rows, and chapter-cleared evidence. Live draft rows are for the teacher studio only.
3. **`course-complete`** means every currently published snapshot is fully present in `learner_progress`. It must not flip off because a draft level exists. It may lock again for a brand-new published module the student has not finished; the achievement row stays because `previouslyEarned` is monotonic. That existing rule is correct. Module badges are stricter: they never flip off even when a new revision adds levels.
4. **Do not award badges or XP in demo mode for a signed-in student.** Keep the current identity isolation.

## Explicitly out of scope

- Restyling buttons, landmass, wooden HUD, or book covers to look like Duolingo.
- Leagues, gems, streak freeze shop, or push notifications.
- Chopping lesson prose into single-sentence drills.
- Teacher gradebook, JMM, or auth work, unless a mobile teacher screen overflows at 320px while you are already in that file.
- Client-side badge writes, localStorage badges, or deriving “permanent” completion only in `profile-derived.ts`. `deriveTrophies` is a fixture helper. Production badges come from `learner_module_badges`.

## Suggested agent split

These batches touch different files if the badge contract above is treated as frozen.

| Batch | Owns | Done when |
| --- | --- | --- |
| A | Migration, award transaction, backfill, shared schema, `GET /profile/stats`, completion payload fields, API tests | Badge survives a new revision and an unpublish; second learner isolated |
| B | Profile shelf, avatar, achievement wall, home badge chip, completion badge beat | 360px profile shows a badge the live progress percentage no longer calls complete |
| C | Level session: hide nav, sticky Continue, game progress bar, remove placeholder quotes | A lesson and a quiz are finishable with the thumb and no bottom nav |
| D | Path scroll container, section min-height, 44px toolbar, node-label collision | Reload on a phone returns to the same node; chapters are not empty viewports |
| E | HUD 320px, nav labels, Settings reachability, daily goal + streak beat, XP copy | Three stats readable at 320px; goal and streak copy match the server |

Batch A lands first or in parallel with a stubbed response only if B compiles against the shared schema in the same PR. Do not invent a second badge shape in the UI.

## Verification each agent must run

- `npm test` for the workspaces touched.
- `npm run lint` in `apps/web` if TSX changed.
- At 360×740 in the browser: Learn home, a path, a lesson continue, a quiz from question 1 to the celebration, Profile with zero badges and with one earned badge.
- At 320×700: status HUD, bottom nav labels, path node titles.
- Keyboard: Continue, Got it, and Current are reachable; the why sheet traps focus as it does today.
