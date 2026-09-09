# Jose design language

**Date:** 2026-09-08  
**Status:** source of truth for UI that is in the product today  
**App:** Jose (`apps/web`)

This document describes the **current student UI**, not a future restyle. Teacher screens use the same language, with the extra rules in `2026-09-08-teacher-area-design.md`.

## Product feel

Jose is a short-lesson learning app. Chrome is calm. Primary actions are bright and chunky. Copy is plain English. There is no second brand name in the student shell.

## Type

- **Family:** Nunito, via `--font-jose-sans` (`--font-sans` / `--font-display`).
- **Wordmark:** `font-display`, 4xl, black, tight tracking, `--jose-accent`.
- **Titles:** display, semibold/black, tracking-tight, `--jose-ink`.
- **UI labels:** extrabold. Body: regular/semibold. Line height ~1.7 in lesson prose (`.jose-prose`).

## Color (light)

Defined in `apps/web/src/app/globals.css` `:root`:

| Token | Value | Use |
| --- | --- | --- |
| `--jose-green` | `#58cc02` | Primary buttons, active nav ring, progress |
| `--jose-accent` | `#387c10` | Wordmark, active nav text |
| `--jose-accent-soft` | `#dff5ce` | Active nav fill, success wash |
| `--jose-ink` | `#344054` | Body text |
| `--jose-ink-soft` | `#475467` | Secondary text |
| `--jose-ink-muted` | `#667085` | Hints, inactive nav |
| `--jose-paper` / `--jose-surface` | `#ffffff` | Cards, side nav |
| `--jose-wash` | `#f1fae9` | Soft green page wash |
| `--jose-cream` | `#f7fafc` | Page backdrop |
| `--jose-rule` | `#e2e7ec` | Borders, secondary button shadow |
| `--jose-gold` / `--jose-gold-deep` | `#ffc800` / `#d59e00` | Path nodes, XP |
| `--jose-sky` | `#087eaf` | Focus ring, secondary emphasis |
| `--jose-coral` | `#d63649` | Errors, misses |
| `--jose-surface-control` | `#edf1f5` | Hover wash, disabled buttons |

Dark theme remaps the same token names (see `html[data-theme="dark"]`). Do not invent a second palette.

## Shape and size

- **Controls:** min-height 44px (`min-h-11`) or `.jose-button` at 3rem.
- **Corners:** pills for buttons (`rounded-full` or 1rem on `.jose-button`). Cards `rounded-2xl` / `1.75rem`. Nav rows `rounded-2xl`.
- **Primary button (`.jose-button`):** green fill, dark green text `#234b12`, 2px transparent border, 4px bottom shadow `#46a302`. Press moves down 3px.
- **Secondary (`.jose-button--secondary`):** paper fill, sky text, rule border and shadow.
- **Cards (`.learning-card`):** paper, rule border, 4px bottom shadow; hover lifts 2px.

## Chrome (student)

Implemented by `AppShell` in `learning-shell.tsx` (shared `JoseShell`).

- Desktop: 15rem side nav, paper/95, rule border, backdrop blur.
- Wordmark **Jose**. Subtitle: “Learn something new today”.
- Tabs: Learn, Practice, Bookmarks, Profile. Icons + extrabold labels.
- Active tab: `.jose-nav-active` (accent-soft fill, accent text, inset 2px green ring).
- Teachers also see **Teacher area** (still student chrome, green active).
- Footer: Settings.
- Mobile: bottom tabs, same destinations, safe-area padding. No separate top app bar required.
- Main column scrolls. `html, body { overflow: hidden; height: 100% }`.

## Motion

- Control 150ms, screen 220ms, milestone 420ms, ease `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Respect reduced motion (`.jose-focus` / preferences).

## Focus

Visible 3px `--jose-sky` outline, 3px offset, on interactive elements.

## Screens this language already covers

Learn path, practice, bookmarks, profile, lesson reader, five games (Timeline, Quiz, Matching, Sorting, Fill in the Blank). Game boards may use gold/coral/sky for play states; chrome around them stays Jose.

## Do not

- Do not treat older Superpowers specs as visual direction.
- Do not introduce a second typeface or a CMS grey/violet-only look for student pages.
- Do not copy another product’s branding.
