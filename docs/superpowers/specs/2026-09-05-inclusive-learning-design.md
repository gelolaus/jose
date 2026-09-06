# Inclusive learning design (issues #32–#36)

**Date:** 2026-09-05  
**Status:** Implemented with explicit incomplete boundaries  
**Branch:** `25-36-student-experience`

## Goals

Make Jose inclusive and resilient: private journal/bookmarks, language and reading preferences, complete keyboard/screen-reader/touch flows, calm loading/recovery, and measured low-bandwidth support — without inventing translations or production storage.

## Architecture choices

### Journal (#32 / ticket 30)

- Private notes, bookmarks, excerpts, and reflections store **on-device** under `jose.journal.v1:account:<immutable learner/user id>`.
- Display names are never used as storage keys. Changing a name does not move or drop notes. Two accounts that share a display name on one computer keep separate blobs.
- The unscoped prototype key `jose.journal.v1` and `local:<name>` owner keys are not adopted.
- Visibility defaults to `private`. `teacher_submitted` is a separate label and is **excluded** from private exports.
- Private notes are **never** sent to the learning API.
- Glossary and book/character/place catalog ship as **incomplete stubs** marked in UI.

### Language & reading (#33 / ticket 31)

- UI chrome dictionaries: English + Filipino (`apps/web/src/lib/reading-preferences.ts`).
- Lesson body / assessment key translations are **not invented**. Preferences surface an incomplete-state message until curated content is supplied.
- Text size, reduce-motion override, and opt-in sound persist locally. Narration stays unavailable until licensed audio exists.
- `SourceQuote` vs `ExplanationNote` keep historical wording distinguishable from teaching paraphrase.

### Accessibility (#34 / ticket 32)

- `FieldLabel` + `htmlFor`, named color swatches + contrast helpers, `aria-current` on nav, skip link, focus trap/return on WhySheet and memory timeout, semantic top-bar chips, memory flip live region, min 44px touch targets on key controls.

### Recovery (#35 / ticket 33)

- Route `loading.tsx` / `error.tsx` for learn, profile, practice.
- `RecoveryState` replaces student “napping” + `npm run dev:api` copy. Dev diagnostics only when `NODE_ENV !== "production"`.
- Offline vs unavailable classification; breadcrumbs and consistent Back links.

### Low bandwidth (#36 / ticket 34)

- Font `display: "swap"`, image format preferences, `optimizePackageImports` for lucide.
- Practice-only lesson pack manifests with revision guard and logout eviction.
- Assessed attempts remain online-only until reconciliation is proven.
- Measurement template below — **do not claim “fast” without device data**.

## What you must provide

| Need | Why |
|------|-----|
| Curated Filipino lesson translations + quotation alignments | Content i18n incomplete by design |
| Licensed narration/transcript audio assets | Narration remains disabled |
| Production journal storage (account-scoped, encrypted at rest if required) | Today private notes are device-local only |
| Support contact mailbox (replace `support@example.com`) | Recovery “Contact support” link |
| CDN/storage URLs + content revision stamps for lesson packs | Pack stub records metadata only |
| Representative low-end phone measurements (fill template) | Publish measured results, not badges |
| Editorial glossary / catalog copy | Seed entries are incomplete placeholders |
| Remote image host allowlist in `next.config.ts` | `remotePatterns` intentionally empty |

## Bandwidth measurement template

Record results in `docs/reviews/2026-09-05-low-bandwidth-measurements.md` after running on a real device. Until then, `verified: false`.

## Privacy rules

1. Default journal visibility = private.
2. Private export never includes `teacher_submitted` unless the learner explicitly opts in to a separate export.
3. Journal keys are immutable account IDs. Sign-out clears drafts, explorer cosmetics, lesson packs, and legacy journal blobs; it **keeps** `jose.journal.v1:account:*` so the same account can recover notes after a name change or later sign-in. Switching accounts loads the next ID’s store without copying.
4. Shared-device logout clears lesson packs for that account key.
5. Do not POST private reflections to learning APIs.
6. Production account-scoped journal storage is still owner-provided.
