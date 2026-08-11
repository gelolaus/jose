# Jose — Fun Profile Page Design

**Date:** 2026-08-11  
**Status:** Approved for implementation  
**Product:** Jose — kids-first gamified path for *The Work and Life of Rizal*

## Goal

Turn `/profile` from a stub into a playful **explorer card** showcase: avatar + editable local identity, demo XP/streak/hearts, a journey progress peek, and a small trophy teaser. Soft-bounce motion matching the path nodes. No real auth.

## Non-goals

- Real accounts / server-persisted identity
- Full badge economy or badge unlock API
- Hearts/streak economy logic beyond demo numbers
- Practice tab work

## Decisions (locked)

| Choice | Decision |
| --- | --- |
| Feel | Explorer card (Duolingo-lite) |
| Identity | Full edit stub: display name + avatar picker, `localStorage` only |
| Extra sections | Journey peek **and** trophy teaser |
| Motion | Soft bounce (float avatar, light press on chips) |
| Edit UX | Separate `/profile/edit` route; profile is view-only showcase |
| Architecture | Client-local identity + reuse `GET /path/demo` for stats/journey/trophies |

## Architecture

```
/profile  → fetchDemoPath() + read localStorage identity → ProfileShowcase
/profile/edit → read/write localStorage identity → navigate back to /profile
```

- **Stats / journey / trophies:** from existing `PathResponse` (no new API).
- **Identity:** `localStorage` key `jose.explorer` → `{ displayName: string, avatarId: string }`.
- **Defaults:** if storage missing/invalid, use API `learner.displayName` (“Explorer”) and default avatar `compass`.

## Routes

| Route | Behavior |
| --- | --- |
| `/profile` | Showcase: avatar (float), name, Edit CTA, XP/streak/hearts chips, journey peek, trophy teaser |
| `/profile/edit` | Name field + avatar grid; Save writes storage + goes to `/profile`; Cancel goes back without write |

Both use existing `AppShell` (sidebar + bottom tabs). Active tab remains Profile for `/profile/edit` (pathname starts with `/profile`).

## UI sections (`/profile`)

1. **Explorer card** — large soft-floating avatar circle (color from avatar catalog), display name, short subtitle (“Rizal path explorer”), primary **Edit explorer** link to `/profile/edit`.
2. **Stat chips** — XP, streak, hearts (same tones as top bar; pressable feel via `:active` translate, not real actions).
3. **Journey peek** — one row of section pills from `sections[]`: title + `completedCount/total` (completed nodes only). Current section gets a subtle highlight using `themeColor`.
4. **Trophy teaser** — exactly three slots derived from path data (see below). Unlocked = lit gold; locked = dimmed with lock affordance. Decorative only (not tappable destinations).

### Trophy rules (deterministic from demo path)

| Id | Title | Unlocked when |
| --- | --- | --- |
| `childhood-clear` | Childhood cleared | Every node in section `childhood` is `completed` |
| `first-treasure` | First treasure | Any `kind === "chest"` node is `completed` |
| `on-the-path` | On the path | Any node has `status === "current"` |

## Avatar catalog

Fixed client catalog (SVG/Lucide, no image assets):

| `avatarId` | Label | Accent | Icon idea |
| --- | --- | --- | --- |
| `compass` | Compass | sky | Compass |
| `sun` | Sun | amber | Sun |
| `book` | Book | violet | BookOpen |
| `star` | Star | gold | Star |
| `leaf` | Leaf | green | Leaf |
| `ship` | Ship | coral | Ship |

Default: `compass`.

## `/profile/edit` behavior

- Load identity from storage (or defaults).
- Display name: required, trim, 1–20 chars; show inline validation if empty/too long.
- Avatar: radio-style grid of the six options; selected ring.
- **Save:** validate → write `jose.explorer` → `router.push("/profile")`.
- **Cancel:** `router.push("/profile")` with no write.
- Soft bounce: selected avatar uses existing `float-soft` utility.

## Data helpers

Pure functions (unit-tested):

- `parseExplorerIdentity(raw: unknown): ExplorerIdentity | null`
- `readExplorerIdentity(): ExplorerIdentity | null` / `writeExplorerIdentity(id: ExplorerIdentity): void` (browser-only wrappers)
- `sectionProgress(section): { completed: number; total: number }`
- `deriveTrophies(path: PathResponse): Trophy[]` with `{ id, title, unlocked }`

## Error handling

- Path API failure on `/profile`: same friendly “napping” empty state + Retry as Learn (no crash). Edit page does **not** require the API.
- Corrupt `localStorage`: treat as missing → defaults.
- SSR: do not read `localStorage` on the server; client components hydrate identity after mount (avoid mismatch — show API/default name until mounted if needed).

## Visual language

- Reuse Jose cream surface, Nunito/Fredoka, gold/coral/sky chips, rounded-3xl chrome.
- Soft bounce only (no confetti).
- Mobile-first column `max-w-3xl` centered; not a dashboard of cards — one vertical composition: hero identity → stats → journey → trophies.

## Testing

- Unit: identity parse/validate; section progress; trophy derivation against a small fixture path.
- Component (optional smoke): edit form rejects empty name; profile renders trophy titles when given path props.

## Success criteria

1. `/profile` shows avatar, name, XP/streak/hearts from demo API, journey peek, three trophies.
2. `/profile/edit` can change name + avatar; reload keeps identity via `localStorage`.
3. Cancel does not persist edits.
4. Soft float on avatar; chips press lightly.
5. Profile tab stays active on edit route; layout works mobile + desktop shell.
