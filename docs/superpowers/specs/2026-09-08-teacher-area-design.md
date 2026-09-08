# Teacher area — Jose chrome and module maker

**Date:** 2026-09-08  
**Status:** approved  
**Depends on:** `2026-09-08-jose-design-language.md`

Teacher `/teach` is the same product as student Learn. Violet marks “you are teaching.” Green stays the primary action color.

## Chrome

Shared `JoseShell` (same layout, type, 44px rows, paper/ink).

| | Student | Teacher |
| --- | --- | --- |
| Tabs | Learn, Practice, Bookmarks, Profile | Modules, Classes, Learn, Profile |
| Active | `.jose-nav-active` (green) | `.jose-nav-active-teach` (violet wash + ring) |
| Wordmark | Jose | Jose |
| Subtitle | Learn something new today | Teach |
| Extra | Teacher area (if `canTeach`) | none |
| Footer | Settings | Settings + local testing (dev only) |

- Modules active: `/teach` and `/teach/modules/*`.
- Classes active: `/teach/classes`.
- Learn and Profile leave Teach and use student chrome.
- Save and Publish use `.jose-button` (green). Violet is nav/badge only.
- Module cards, class cards, empty states use `.learning-card` / student spacing.

## Module maker

One outline (left) and one editor (right). Mobile: outline or editor, not both.

**Outline rows** are a title + kind label. No always-on Move/Dup/Del.

- `⋯` on a level: Move up, Move down, Duplicate, Delete (confirm).
- Drag a level to reorder (including across sections).
- One **Add** control: Lesson, Game (pick type), or Section. Title field appears only after a choice. No stacked Add level / Add section forms.
- Templates stay under a collapsed “Starter structures”.
- **Duplicate module** lives in the module header `⋯` next to Preview / Publish.

**Editor**

- One **Save** for the open level (title + lesson blocks, or title + game).
- Module details and section details also Save explicitly (no autosave).
- Adding, reordering, duplicating, deleting levels/sections still hits the API immediately.
- Incomplete Image / Quote / Glossary / Video / Checkpoint blocks stay local. Save validates with `describeLessonBlocksIssue` and never sends a 400 payload. Title is patched only after blocks (or game) are valid, using the latest revision so retries cannot 409-spam.
- Leave with unsaved level/module/section edits: in-app Save / Discard / Stay. `beforeunload` if the tab closes.
- Preview shows the current editor draft (no extra save). After a successful Save, outline titles and the loaded level update from the server response (no stale “another editor” banner for this flow).
- Block chrome: one **Add** menu; per-block `⋯` for Up / Down / Remove.

## Error handling

- Validation errors are one short line above Save, not a retry loop.
- Real 409 (two tabs): one banner + Reload server version. Do not autosave-retry.
- Publish blockers still list jump links to the offending level.

## Testing

- Shell: student tabs hide teacher tools for students; teachers see Teacher area on student chrome; `/teach` shows Modules / Classes / Learn / Profile.
- `describeLessonBlocksIssue` covers empty image/quote/glossary/video/checkpoint.
- Level editor does not PUT/PATCH on adding an empty block; Save with an empty image never calls the lesson API.
- After Save, outline title matches the saved title.

## Out of scope

Auth rewrite, database reset, changing the five games, deleting ops/auth/review docs.
