# Fun Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playful explorer profile showcase at `/profile` plus local-only edit at `/profile/edit`, using demo path stats and `localStorage` identity.

**Architecture:** Server pages fetch `GET /path/demo` for stats/journey/trophies. Client modules own avatar catalog, identity read/write, and edit form. Pure helpers derive section progress and trophies from `PathResponse`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Lucide icons, Vitest + Testing Library, `@jose/shared` Zod types.

## Global Constraints

- No new Nest API endpoints — reuse `fetchDemoPath()` only.
- No real auth; identity key is exactly `jose.explorer`.
- Soft-bounce motion only (reuse `.float-soft` / light `:active` presses).
- Exactly three trophy slots with ids `childhood-clear`, `first-treasure`, `on-the-path`.
- Avatar ids: `compass` | `sun` | `book` | `star` | `leaf` | `ship`.
- Display name: trimmed, length 1–20.
- Do not commit unless the user explicitly asks (user rule overrides plan commit steps).
- Preserve existing `AppShell` tab active logic (`pathname.startsWith("/profile")`).

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/lib/explorer-identity.ts` | Types, parse/validate, localStorage read/write |
| `apps/web/src/lib/explorer-identity.test.ts` | Identity unit tests |
| `apps/web/src/lib/profile-derived.ts` | `sectionProgress`, `deriveTrophies` |
| `apps/web/src/lib/profile-derived.test.ts` | Progress + trophy unit tests |
| `apps/web/src/lib/avatar-catalog.ts` | Fixed avatar options (id, label, accent classes, icon) |
| `apps/web/src/components/explorer-avatar.tsx` | Renders one avatar by id (size variants) |
| `apps/web/src/components/profile-showcase.tsx` | Client showcase: identity hydrate + card/stats/journey/trophies |
| `apps/web/src/components/profile-edit-form.tsx` | Client edit form |
| `apps/web/src/app/profile/page.tsx` | Server: fetch path, shell, showcase |
| `apps/web/src/app/profile/edit/page.tsx` | Server/client edit route |

---

### Task 1: Explorer identity helpers

**Files:**
- Create: `apps/web/src/lib/explorer-identity.ts`
- Test: `apps/web/src/lib/explorer-identity.test.ts`

**Interfaces:**
- Produces:
  - `export type ExplorerIdentity = { displayName: string; avatarId: string }`
  - `export const EXPLORER_STORAGE_KEY = "jose.explorer"`
  - `export const DEFAULT_AVATAR_ID = "compass"`
  - `export const AVATAR_IDS = ["compass","sun","book","star","leaf","ship"] as const`
  - `export type AvatarId = (typeof AVATAR_IDS)[number]`
  - `export function isAvatarId(value: string): value is AvatarId`
  - `export function normalizeDisplayName(raw: string): string | null` — trim; null if empty or >20
  - `export function parseExplorerIdentity(raw: unknown): ExplorerIdentity | null`
  - `export function readExplorerIdentity(): ExplorerIdentity | null`
  - `export function writeExplorerIdentity(identity: ExplorerIdentity): void`

- [ ] **Step 1: Write failing tests** in `explorer-identity.test.ts` covering: valid parse; reject bad avatar; reject empty name; `normalizeDisplayName` trim/length; `parseExplorerIdentity` on JSON string shape `{displayName, avatarId}`.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test --workspace=@jose/web -- src/lib/explorer-identity.test.ts
```

- [ ] **Step 3: Implement `explorer-identity.ts`**

```ts
export const EXPLORER_STORAGE_KEY = "jose.explorer";
export const DEFAULT_AVATAR_ID = "compass";
export const AVATAR_IDS = ["compass", "sun", "book", "star", "leaf", "ship"] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export type ExplorerIdentity = { displayName: string; avatarId: AvatarId };

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export function normalizeDisplayName(raw: string): string | null {
  const displayName = raw.trim();
  if (displayName.length < 1 || displayName.length > 20) return null;
  return displayName;
}

export function parseExplorerIdentity(raw: unknown): ExplorerIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.displayName !== "string" || typeof record.avatarId !== "string") {
    return null;
  }
  const displayName = normalizeDisplayName(record.displayName);
  if (!displayName || !isAvatarId(record.avatarId)) return null;
  return { displayName, avatarId: record.avatarId };
}

export function readExplorerIdentity(): ExplorerIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(EXPLORER_STORAGE_KEY);
    if (!raw) return null;
    return parseExplorerIdentity(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeExplorerIdentity(identity: ExplorerIdentity): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPLORER_STORAGE_KEY, JSON.stringify(identity));
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit only if user asked** — otherwise skip.

---

### Task 2: Profile derived helpers + avatar catalog

**Files:**
- Create: `apps/web/src/lib/profile-derived.ts`
- Create: `apps/web/src/lib/profile-derived.test.ts`
- Create: `apps/web/src/lib/avatar-catalog.ts`

**Interfaces:**
- Consumes: `PathResponse`, `Section` from `@jose/shared`; `AvatarId` from explorer-identity
- Produces:
  - `sectionProgress(section: Section): { completed: number; total: number }`
  - `export type Trophy = { id: "childhood-clear" | "first-treasure" | "on-the-path"; title: string; unlocked: boolean }`
  - `deriveTrophies(path: PathResponse): Trophy[]` — always length 3 in that order
  - `AVATAR_CATALOG: { id: AvatarId; label: string; bubbleClass: string; iconClass: string }[]`

- [ ] **Step 1: Write failing tests** for childhood-clear / first-treasure / on-the-path using a tiny fixture path; assert `sectionProgress` counts.

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test --workspace=@jose/web -- src/lib/profile-derived.test.ts
```

- [ ] **Step 3: Implement helpers + catalog**

`sectionProgress`: `total = nodes.length`, `completed = nodes.filter(n => n.status === "completed").length`.

`deriveTrophies`:
1. `childhood-clear` — find section id `childhood`; unlocked if every node completed (false if section missing).
2. `first-treasure` — any node with `kind === "chest"` and `status === "completed"`.
3. `on-the-path` — any node with `status === "current"`.

Avatar catalog maps each `AvatarId` to label + Tailwind bubble/icon classes (sky/amber/violet/gold/green/coral).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit only if user asked**

---

### Task 3: Avatar + showcase + profile page

**Files:**
- Create: `apps/web/src/components/explorer-avatar.tsx`
- Create: `apps/web/src/components/profile-showcase.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `PathResponse`; identity helpers; `sectionProgress`; `deriveTrophies`; `AVATAR_CATALOG`
- Produces: `ExplorerAvatar({ avatarId, size?: "md" | "lg", floating?: boolean })`; `ProfileShowcase({ path: PathResponse })`

- [ ] **Step 1: Implement `ExplorerAvatar`** — look up catalog; render Lucide icon in colored rounded circle; optional `float-soft`.

- [ ] **Step 2: Implement `ProfileShowcase` (client)**  
  - On mount: `readExplorerIdentity()` else `{ displayName: path.learner.displayName, avatarId: DEFAULT_AVATAR_ID }`.  
  - Layout: explorer card → three stat chips (XP/streak/hearts) → Journey peek → Trophy teaser.  
  - Edit link → `/profile/edit`.  
  - Journey: map sections to pills with `completed/total` and themeColor border/dot for section containing a `current` node (else first incomplete).  
  - Trophies: three slots; unlocked gold, locked dim + Lock icon.

- [ ] **Step 3: Wire `profile/page.tsx`** like Learn: `fetchDemoPath`, error empty state, else `AppShell` + `ProfileShowcase`.

- [ ] **Step 4: Manual check** — `npm run dev` → `/profile` shows demo stats + three trophies (Childhood cleared + First treasure + On the path should unlock on current demo seed).

- [ ] **Step 5: Commit only if user asked**

---

### Task 4: Edit route

**Files:**
- Create: `apps/web/src/components/profile-edit-form.tsx`
- Create: `apps/web/src/app/profile/edit/page.tsx`

**Interfaces:**
- Consumes: identity helpers, avatar catalog, `ExplorerAvatar`
- Produces: working `/profile/edit` with Save/Cancel

- [ ] **Step 1: Implement `ProfileEditForm`**  
  - State from `readExplorerIdentity()` or defaults (`Explorer` / `compass`).  
  - Name input + validation message.  
  - Avatar radio grid.  
  - Save: `normalizeDisplayName` + `isAvatarId` → `writeExplorerIdentity` → `router.push("/profile")`.  
  - Cancel: `router.push("/profile")`.

- [ ] **Step 2: `edit/page.tsx`** — `AppShell` + centered form (no API required).

- [ ] **Step 3: Verify** — change name/avatar, Save, reload `/profile` keeps values; Cancel discards.

- [ ] **Step 4: Run full web tests**

```bash
npm test --workspace=@jose/web
```

Expected: all PASS.

- [ ] **Step 5: Commit only if user asked** — draft Conventional Commit message for the user instead.

---

## Spec coverage checklist

- Explorer card + stats → Task 3  
- Journey peek + trophies → Tasks 2–3  
- localStorage identity + `/profile/edit` → Tasks 1, 4  
- Soft bounce → Task 3–4 (`float-soft`, chip `:active`)  
- API error UI → Task 3  
- No new API → Global constraint  
