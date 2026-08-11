# Jose — Rizal Levels Path Design

**Date:** 2026-08-07  
**Status:** Approved for implementation  
**Product:** Jose — kids-first gamified path for the Filipino college course *The Work and Life of Rizal*

## Goal

Ship a mobile-first Duolingo-style levels path backed by Nest, with demo progress only. Lesson content is placeholder. Learners can scroll a winding path, see section colors, tap unlocked nodes into a stub lesson, and feel “kids fun” chrome (streak/hearts stubs + bottom tabs on mobile; left sidebar + journey map on large screens). Section theme colors are full-bleed on every breakpoint — never a phone-width letterbox on desktop.

## Non-goals (v1)

- Real auth / saved progress
- Real lesson content or quiz engine
- Admin CMS / content editor
- Payments, streaks logic, or hearts economy beyond UI stubs

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + npm workspaces |
| Web | Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript |
| API | NestJS (REST), TypeScript |
| Shared | Zod schemas + inferred types in `packages/shared` |
| Tests | Vitest (shared + web), Nest Jest (api) |

Craft notes from wantap.cc (process and quality, not dark theme): custom Google fonts via `next/font`, CSS variables for brand, strict TS, Zod at boundaries, component tests for critical UI.

## Architecture

```
apps/web  →  GET http://localhost:3001/path/demo  →  apps/api
                ↑
         packages/shared (PathResponse schema)
```

- **Nest** owns the seeded curriculum + demo learner state. No database in v1 — in-memory module constant.
- **Next** owns presentation: learning shell, path zig-zag, node states, placeholder lesson route.
- **Shared** owns `PathResponse`, `Section`, `LevelNode`, status enums — validated on the API response before render.

### Repo layout

```
jose/
  apps/
    web/          # Next.js — :3000
    api/          # NestJS  — :3001
  packages/
    shared/       # Zod + types
  docs/superpowers/
    specs/
    plans/
```

## Domain model

### Chronological sections (colored bands)

1. **Childhood** — Calamba beginnings  
2. **Education** — Biñan, Ateneo, UST, Madrid  
3. **Travels** — Europe and beyond  
4. **Noli & Fili** — novels and reform  
5. **Martyrdom** — trial and Bagumbayan  

Each section has: `id`, `title`, `subtitle`, `themeColor` (hex used as path background while that section is in view / as section header accent), ordered `nodes[]`.

### Node kinds

- `lesson` — gold circular node with icon (`check` | `book` | `star`)
- `chest` — treasure milestone on a small pedestal

### Node status (demo)

- `completed` — check icon, fully lit, tappable → placeholder lesson  
- `current` — prominent, subtle pulse, tappable → placeholder lesson  
- `locked` — dimmed, tap → shake + toast “Finish the previous level”

Demo seed: first section mostly completed, one `current` near start of Education, rest locked. Include at least one `chest` after Childhood.

## API

### `GET /path/demo`

Returns `PathResponse`:

```ts
{
  course: { id: "rizal", title: "Work and Life of Rizal" },
  learner: { displayName: "Explorer", streak: 3, hearts: 5, xp: 120 },
  sections: Section[]
}
```

Each node includes `id`, `title`, `kind`, `status`, `icon`, `position` (`left` | `center` | `right`) for zig-zag layout.

CORS enabled for `http://localhost:3000`. Health: `GET /health` → `{ ok: true }`.

## Web UX

### Mobile-first learning shell

- **Top bar:** course short title, XP chip, streak flame stub, hearts stub  
- **Section banner:** sticky-ish card showing active section title + color  
- **Main:** vertically scrolling zig-zag path; generous spacing; section background color transitions as you scroll through sections  
- **Bottom tabs:** Learn (path) · Practice (placeholder) · Profile (placeholder)  
- Desktop/tablet: centered column (`max-w-md` / `max-w-lg`), wide soft margins, same path — not a dashboard redesign

### Visual language (“kids fun” hybrid)

- Bright section fills (not wantap dark chrome)  
- Gold 3D nodes (`#F4C430` face, deeper gold extruded edge)  
- Rounded, bouncy micro-interactions (node press, locked shake)  
- Fonts: friendly rounded sans (e.g. Nunito) + playful display for section titles  
- CSS variables for `--jose-gold`, section themes, surfaces  
- Simple SVG icons/mascot accents optional; no dependency on external illustration packs for v1 — CSS/SVG shapes OK

### Routes

| Route | Behavior |
| --- | --- |
| `/` | Redirect to `/learn` |
| `/learn` | Path page (default tab) |
| `/learn/[nodeId]` | Placeholder lesson (“Coming soon”) for completed/current; if locked id, redirect back with message |
| `/practice`, `/profile` | Stub pages inside same shell |

### Data loading

Server Component or client fetch to `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`). Validate with Zod. On failure: friendly retry UI, no crash.

## Error handling

- API unreachable → empty state with Retry  
- Invalid payload → treat as error (Zod fail)  
- Locked tap → local animation + toast, no navigation  
- Unknown `nodeId` on lesson route → not-found → back to `/learn`

## Testing

- **shared:** schema accepts seed-shaped payload; rejects missing status  
- **api:** `GET /path/demo` returns 200 and matches schema; `GET /health` ok  
- **web:** LevelNode locked vs current class/behavior; PathResponse render smoke if practical

## Success criteria

1. `npm install` at root, then start api + web, open `http://localhost:3000/learn`  
2. See multi-section colored path with gold nodes and chrome  
3. Tap current/completed → placeholder lesson; locked → shake/toast  
4. Bottom tabs navigate to stubs  
5. Layout readable on phone width and desktop centered column  

## Out of scope follow-ups

Real Nest persistence, Auth.js, lesson runtime, teacher dashboard.
