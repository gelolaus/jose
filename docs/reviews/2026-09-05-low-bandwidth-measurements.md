# Low-bandwidth measurements (issue #36 / ticket 34)

**Status:** Incomplete — fill after measuring on a representative lower-end phone.  
**Do not** publish an unverified “fast” claim.

## Environment (owner fills)

| Field | Value |
|-------|-------|
| Device | _e.g. entry-level Android, year/model_ |
| Network | _e.g. Slow 3G / throttled 1.5 Mbps_ |
| Build | production `next start` / staging URL |
| Date | |

## Critical routes

| Route | Load (ms) | Interaction ready (ms) | Notes | Verified |
|-------|-----------|------------------------|-------|----------|
| `/learn` | | | | no |
| `/learn/[moduleId]` | | | | no |
| `/learn/[moduleId]/[levelId]` lesson | | | | no |
| `/practice` | | | | no |
| `/journal` | | | | no |

## Optimizations already in code

- Google fonts with `display: "swap"` and preload
- Next image AVIF/WebP preference; remote hosts not allowlisted until you provide them
- `optimizePackageImports` for `lucide-react`
- Optional practice-only lesson pack manifests with revision guards
- Assessed attempts stay online-only

## Pack storage you must provide

- CDN or blob base URL for pack payloads
- Stable `contentRevision` per published module revision
- Account session hook to call `clearLessonPacksForLogout(ownerKey)` on shared-device sign-out
