# Jose — Modules, lessons, and games

**Date:** 2026-08-15  
**Status:** Approved for implementation  
**Product:** Jose — kids-first gamified path for *The Work and Life of Rizal*

## Goal

Replace the single homepage path with a **module grid**. The seeded Life of Rizal path is the featured module (start to finish). Teachers add **deep-dive** modules (school, lovers, and so on). Each module opens the existing zig-zag path. Levels are **lesson** (Markdown + optional YouTube) or **game** (five types). A separate **Teacher studio** shell lets teachers create and edit modules, sections, and levels at any time.

## Locked decisions

| Choice | Decision |
| --- | --- |
| Course | Still Rizal only. Featured module = full life path. Other modules = deep dives. |
| Home | Module grid. Featured card first. Tap → that module’s path. |
| Unlock | Sequential inside every module. Finish level n to open n+1. |
| Games | Completing the activity unlocks the next level. Score is shown. Retry anytime. |
| Attempts | Saved on the demo learner (`score`, `maxScore`, time). No monitor UI this version. |
| Auth | None. Teach mode is open. Roles exist in the data model (`demo-student`). |
| Teach door | Profile → Teacher studio. Route `/teach`. |
| Teach chrome | Different shell. No Learn / Practice / Profile tabs. Back to student view. |
| Sections | A module has one or more colored bands. Life of Rizal keeps five. Deep dives usually one. |
| Persistence | Drizzle + libSQL, local `apps/api/data/jose.sqlite`. Same schema as Turso later. |
| Publish | New modules start unpublished. Student grid shows `published = true` only. |
| Chests | Seeded Life of Rizal keeps treasure nodes. Teacher creates lesson or game only. |
| Practice | Stub. Replay and extra drills wait. |
| Images in memory | Teacher pastes https URLs. No file upload this version. |
| Featured module | Editable. Not deletable. |

## Non-goals (this version)

- Teacher/student accounts
- Attempt monitor UI, leaderboards, pass marks
- Turso cloud URL (local file only)
- Extra game types, image upload, Practice content
- Hearts/streak economy beyond stored demo numbers

See `docs/superpowers/specs/2026-08-15-jose-future-work.md`.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 16 App Router, same Jose chrome (Nunito, Fredoka, cream, gold nodes) |
| API | NestJS REST |
| DB | Drizzle ORM + `@libsql/client`, SQLite file |
| Shared | Zod schemas in `packages/shared` |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize` |
| YouTube | Paste URL → store 11-char video id → `youtube-nocookie.com/embed` |

## Architecture

```
Student shell (/learn, /profile, /practice)
Teach shell (/teach)
        │  REST + Zod
        ▼
   Nest curriculum module
        │  Drizzle
        ▼
  apps/api/data/jose.sqlite
```

- Next never opens SQLite.
- Demo learner id is `demo-student`. Later accounts replace that id; tables stay.
- `GET /path/demo` still returns the **featured** module path (profile, trophies).
- `GET /modules` returns published cards for the student home.

## Domain

### Tables

- `learners` — `id`, `displayName`, `streak`, `hearts`, `xp`
- `modules` — `id`, `title`, `subtitle`, `coverColor`, `sortOrder`, `published`, `featured`, timestamps
- `sections` — `id`, `moduleId`, `title`, `subtitle`, `themeColor`, `sortOrder`
- `levels` — `id`, `sectionId`, `title`, `kind` (`lesson` \| `game` \| `chest`), `gameType` (nullable), `sortOrder`
- `lesson_content` — `levelId`, `markdown`, `youtubeVideoId`
- `game_content` — `levelId`, `json` (discriminated by `type`)
- `learner_progress` — `learnerId`, `levelId`, `completedAt`
- `attempts` — `id`, `learnerId`, `levelId`, `score`, `maxScore`, `payload` JSON, `createdAt`

Status on the path is **derived**: completed ids + module order → first incomplete is `current`, rest `locked`. Retry does not clear completion.

### Five games

| Type | Play | Teacher authors | Score |
| --- | --- | --- | --- |
| `quiz` | One question at a time, tap a choice | Prompt, choices, correct index | correct / total |
| `memory` | Flip two cards; picture–picture, picture–text, or text–text | Pairs of sides (`text` and/or `imageUrl`) | `max(0, pairs*100 - mismatches*10)` / `pairs*100` |
| `timeline` | Reorder with up/down (mobile-safe) | Items in correct order | items in the right index / n |
| `blank` | Sentence with `___`; pick from a word bank | Sentence, answer, decoys | correct items / n |
| `sort` | Tap item, tap bucket (2–3 buckets) | Bucket labels + items | correct bucket / n |

### Seed

1. **Life of Rizal** (`rizal`) — featured, published, five sections from the current demo path, same completion seed, short Markdown on lesson nodes.
2. **Ateneo days** — published deep dive, one section, lesson + quiz + memory, no progress (level 1 current).

First API boot: create tables if missing, seed if `modules` is empty.

## Student UX

### Routes

| Route | Behavior |
| --- | --- |
| `/` | Redirect `/learn` |
| `/learn` | Published module grid |
| `/learn/[moduleId]` | Zig-zag path (reuse `PathView`) |
| `/learn/[moduleId]/[levelId]` | Lesson, game, or chest |
| `/practice` | Stub |
| `/profile` | Explorer card + Teacher studio button |
| `/profile/edit` | Unchanged |

### Home grid

- Cream page, rounded-3xl cards, `coverColor` fill, Fredoka title, progress `completed/total`.
- Featured card labeled “The full story”, listed first.
- Mobile: one column. Tablet/desktop: 2–3 columns, `max-w-6xl`.
- Empty (no published modules): friendly “Nothing published yet”.

### Path

Same gold 3D nodes, section bands, locked shake + toast. Game nodes use a puzzle glyph. Node tap → `/learn/{moduleId}/{levelId}`. Back control on the path returns to the module grid.

### Lesson

Markdown (headings, lists, links, emphasis, code). Optional 16:9 YouTube under the article. **Continue** marks complete (first time) and returns to the path. Already complete: Continue still returns; no second progress row. Locked id: redirect to path.

### Game

Play UI, then score screen (score / max, Retry, Continue). Continue always allowed after one finish. Retry starts the activity again and writes another attempt. Locked: redirect.

### Chest

Short celebration copy + Continue (marks complete).

## Teacher UX

### Shell

`TeachShell`: cream background, left nav on `lg` (Modules, Back to student view), top bar on small screens. No student bottom tabs.

### Routes

| Route | Behavior |
| --- | --- |
| `/teach` | All modules (drafts included). New module. Edit. Delete (not featured). Publish toggle. |
| `/teach/modules/new` | Title, subtitle, cover color. Creates unpublished module + one section. |
| `/teach/modules/[id]` | Edit module fields, sections (add/edit/delete last-section guard), levels (add lesson/game, reorder, delete), link to level editor. |
| `/teach/modules/[id]/levels/[levelId]` | Title + lesson editor or game-type editor. Save anytime. |

Publish fails with a clear message if any lesson/game level has empty invalid content.

Door: Profile button **Teacher studio** → `/teach`.

## API

Student (demo learner implied):

- `GET /modules`
- `GET /modules/:id` — path with derived status
- `GET /path/demo` — featured module path (same shape as `GET /modules/:id`)
- `GET /levels/:id` — play payload; 403 if locked
- `POST /levels/:id/complete` — lessons and chests
- `POST /levels/:id/attempts` — `{ score, maxScore, payload? }`; writes attempt; completes if first time; +10 XP on first complete

Teach:

- `GET|POST /teach/modules`
- `PATCH|DELETE /teach/modules/:id`
- `POST /teach/modules/:id/sections`
- `PATCH|DELETE /teach/sections/:id`
- `POST /teach/sections/:id/levels`
- `PATCH|DELETE /teach/levels/:id`
- `POST /teach/levels/:id/move` — `{ direction: "up" \| "down" }`
- `PUT /teach/levels/:id/lesson`
- `PUT /teach/levels/:id/game`

YouTube: accept full URL or 11-char id; store id only.

## Error handling

- API down: existing “napping” + Retry on student pages; Teach shows the same idea.
- Zod fail on responses: treat as error, no crash.
- Locked play: 403 → redirect to module path.
- Unknown ids: 404.
- Delete featured module: 400.
- Delete last section: 400.
- Publish with invalid level content: 400 with which level is incomplete.
- Bad YouTube URL: inline validation in Teach, do not save.

## Testing

- **shared:** path/module schemas; progress derivation; YouTube id parse; game content union (valid quiz, reject empty memory).
- **api:** health; `GET /modules` includes featured; sequential lock on `GET /levels/:id`; complete unlocks next; attempts insert; cannot delete featured.
- **web:** LevelNode still shakes when locked; module card renders title when given props (smoke).

## Success criteria

1. `npm install`, `npm run build --workspace=@jose/shared`, `npm run dev` → open `/learn` and see at least Life of Rizal + Ateneo days.
2. Tap Life of Rizal → existing-style path with seeded progress.
3. Open current lesson → Markdown; Continue unlocks the next node after refresh.
4. Open Ateneo days → play lesson, then quiz, then memory; retry writes another attempt.
5. Profile → Teacher studio → create a draft module, add a lesson with Markdown + YouTube URL, publish, see it on the student grid.
6. Edit a published lesson after the fact; student sees the correction.
7. Layout works on phone width and desktop (grid columns + Teach sidebar).
