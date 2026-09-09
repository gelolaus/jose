# JMM Import and Authoring Guide (Batch 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated Jose Module Markup (JMM) v1 full-module import with dry-run preview plus atomic draft creation, teacher UI, and authoring guide.

**Architecture:** Shared parser plus Zod validator in `packages/shared` first (no DB), then NestJS preview/commit endpoints in `CurriculumService` with single-transaction draft creation and content-audit row, then Next.js teacher import page/dialog, then `docs/authoring/jose-module-markup-v1.md` guide covering every active game format.

**Tech Stack:** TypeScript, Zod, NestJS, Drizzle ORM + libSQL, Next.js App Router, Vitest/Jest, React Testing Library.

**Spec:** `docs/reviews/2026-09-09-overall-audit-cursor-handoff.md` Batch 3 section + JMM envelope example. Current source on `ui` branch at `9832794`.

## Global Constraints

- Stay on `ui` branch; do not switch branches.
- Do not replace Drizzle, authentication, assessment scoring, migrations, or content revisions.
- Do not deploy, alter a real database, send real email, hard-code authorization on email, or delete data.
- Student profile requests must never change name; teacher-only import routes require `SessionAuthGuard` + `TeacherRoleGuard` + ownership check.
- Preview never writes to DB; commit creates one new owned draft module atomically; never modify existing module in v1.
- Reuse existing `lessonBlockSchema` / `gameContentSchema` / `hexColorSchema` / `parseYoutubeVideoId`; continue sanitizing Markdown; reject unsafe embeds and raw HTML bypass.
- Assign stable import-local IDs only inside parser; never accept caller-supplied DB IDs or owner IDs.
- Store original source text hash + JMM version in content-audit metadata; never treat source text as executable.
- `npm run lint` must be clean; focused tests then `npm test`, lint, build.
- Do not add live autosave during paste in import UI.

---

## File Structure

- Create: `packages/shared/src/jose-module-markup.ts` — tokenizer, parser with line/col errors, Zod-backed validator, shared limits, preview/tree types, request/response schemas. Single source of truth.
- Create: `packages/shared/src/jose-module-markup.test.ts` — all tags, nesting, malformed closes, unsupported game type, bad JSON, unsafe markup, oversized input, missing a11y fields.
- Modify: `packages/shared/src/index.ts:1-30` — re-export JMM module.
- Modify: `apps/api/src/curriculum/curriculum.service.ts` — `previewModuleImport(body)` (no writes) + `commitModuleImport(body, user)` (single `runTx` + `contentAudit` with `jmmVersion` + `sourceHash`).
- Modify: `apps/api/src/curriculum/teach.controller.ts:39-57` — `POST /teach/modules/import/preview`, `POST /teach/modules/import/commit` (before `:id` routes to avoid param collision).
- Create: `apps/api/src/curriculum/module-import.http.spec.ts` — preview no-write, commit draft + preview + publish readiness, failed import leaves no rows, auth 403s.
- Modify: `apps/web/src/lib/path-api.ts:371-383` — `previewModuleImport(source)`, `commitModuleImport(source)` with Zod parse.
- Create: `apps/web/src/components/teach-jmm-import.tsx` — paste area, validation list, read-only outline preview, create-draft confirmation, guide link. No autosave.
- Create: `apps/web/src/components/teach-jmm-import.test.tsx` — paste invalid shows errors no fetch, valid preview shows tree, confirm calls commit.
- Create: `apps/web/src/app/teach/modules/import/page.tsx` — teacher-only page wrapping the component with `TeachTitle` + guide link.
- Create: `docs/authoring/jose-module-markup-v1.md` — grammar, complete examples for every active game type (quiz, memory, timeline, blank, sort), error examples, ready-to-copy LLM prompt requiring citations/alt/transcript/valid JSON, never invent citations or raw HTML.

---

### Task 1: Shared JMM parser + validator

**Files:**
- Create: `packages/shared/src/jose-module-markup.ts`
- Test: `packages/shared/src/jose-module-markup.test.ts`
- Modify: `packages/shared/src/index.ts:1-30`

**Interfaces:**
- Consumes: `gameContentSchema`, `coerceGameContent` from `./games:396-456`, `lessonBlocksSchema`, `rejectUnsafeLessonEmbeds` from `./lesson-blocks:70-154`, `hexColorSchema`, `gameTypeSchema` from `./path:8-20`, `parseYoutubeVideoId` from `./youtube:10-18`, `MAX_LESSON_MARKDOWN_CHARS` from `./limits:5`.
- Produces: `JmmError { message, line, column, tag?, path? }`, `JmmPreview { module, sections }`, `parseJoseModuleMarkup(source: string): { ok, preview?, errors }`, `validateJoseModuleMarkup(source): same`, `jmmImportPreviewSchema`, `jmmImportCommitBodySchema`, `jmmImportPreviewResponseSchema`, `jmmImportCommitResponseSchema`, limits `JMM_MAX_SOURCE_BYTES=200_000`, `JMM_MAX_SECTIONS=20`, `JMM_MAX_LEVELS=60`, `JMM_MAX_TEXT_CHARS=20_000`, `JMM_MAX_IMAGES=30`, `JMM_MAX_GAME_BYTES=60_000`. Types `JmmImportPreview`, `JmmDraftPlan`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/jose-module-markup.test.ts
import { describe, expect, it } from "vitest";
import { parseJoseModuleMarkup } from "./jose-module-markup";

const MINIMAL = `<<<JoseModule version="1">>>
title: The Propaganda Movement
subtitle: Ideas, writings, and reform
coverColor: #22C55E
objectives:
  - Explain why the movement formed.

<<<Section>>>
title: Origins
subtitle: Context before 1882
themeColor: #38BDF8

<<<Lesson>>>
title: Why reform mattered

<<<Text markdown>>>
## A movement across borders

Write ordinary CommonMark here.
<<<Text/>>>
<<<Lesson/>>>
<<<Section/>>>
<<<JoseModule/>>>`;

describe("jmm parser", () => {
  it("parses the minimal envelope with line-accurate tree", () => {
    const res = parseJoseModuleMarkup(MINIMAL);
    expect(res.ok).toBe(true);
    expect(res.preview?.sections).toHaveLength(1);
    expect(res.preview?.sections[0]?.levels).toHaveLength(1);
  });

  it("rejects LIFO violations with line/column", () => {
    const res = parseJoseModuleMarkup(MINIMAL.replace("<<<Lesson/>>>", "<<<Section/>>>"));
    expect(res.ok).toBe(false);
    expect(res.errors[0]?.line).toBeGreaterThan(0);
    expect(res.errors[0]?.column).toBeGreaterThan(0);
  });

  it("rejects unknown tags", () => {
    const res = parseJoseModuleMarkup(MINIMAL.replace("<<<Text markdown>>>", "<<<Fancy>>>"));
    expect(res.ok).toBe(false);
    expect(res.errors[0]?.message).toMatch(/unknown tag/i);
  });

  it("rejects unsupported game type and bad JSON", () => {
    const bad = MINIMAL.replace("<<<Lesson/>>>", `<<<Lesson/>>>\n<<<Game type="chess">>\ntitle: X\n{}\n<<<Game/>>>`);
    const res = parseJoseModuleMarkup(bad);
    expect(res.ok).toBe(false);
  });

  it("rejects unsafe markup and missing alt/transcript", () => {
    const unsafe = MINIMAL.replace("Write ordinary CommonMark here.", `<script>alert(1)</script>`);
    expect(parseJoseModuleMarkup(unsafe).ok).toBe(false);
  });

  it("rejects oversized input", () => {
    const big = "x".repeat(200_001);
    expect(parseJoseModuleMarkup(big).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/shared -- jose-module-markup.test.ts`
Expected: FAIL with "Failed to resolve import ./jose-module-markup" / "parseJoseModuleMarkup is not defined".

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/jose-module-markup.ts` (~450 lines). Key design:

```typescript
import { z } from "zod";
import { coerceGameContent, gameContentSchema } from "./games";
import { lessonBlocksSchema, rejectUnsafeLessonEmbeds } from "./lesson-blocks";
import { gameTypeSchema, hexColorSchema } from "./path";
import { parseYoutubeVideoId } from "./youtube";
import { MAX_LESSON_MARKDOWN_CHARS } from "./limits";
import { createHash } from "node:crypto"; // use sync fn; for browser compat use simple djb2 fallback? Prefer node:crypto in shared only for hash helper guarded by typeof require — simpler: implement sha256Hex via node:crypto import (shared already runs in node for tests + api; web client only needs preview display not hash — export hash helper from api instead). To keep shared isomorphic, implement `jmmSourceHash` as FNV-1a hex (deterministic, no node dep) and let API store sha256 separately if needed. Document as non-crypto content id.

export const JMM_VERSION = "1" as const;
export const JMM_MAX_SOURCE_BYTES = 200_000;
export const JMM_MAX_SECTIONS = 20;
export const JMM_MAX_LEVELS = 60;
export const JMM_MAX_TEXT_CHARS = 20_000;
export const JMM_MAX_IMAGES = 30;
export const JMM_MAX_GAME_BYTES = 60_000;

export const jmmErrorSchema = z.object({
  message: z.string().min(1),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  tag: z.string().optional(),
  path: z.string().optional(),
});
export type JmmError = z.infer<typeof jmmErrorSchema>;
```

Tokenizer: scan `<<<...>>>` with line/col tracking. Tag regex: `/<<<\s*(\/?)\s*([A-Za-z]+)([^>]*)>>>/g`. Record `line = source.slice(0, match.index).split("\n").length`, `column = match.index - source.lastIndexOf("\n", match.index - 1)`. Attributes: parse `key="value"` pairs via `/(\w+)="([^"]*)"/g` for `version`, `type`, `markdown`.

Grammar (case-sensitive tags): `JoseModule`, `Section`, `Lesson`, `Game`, `Text`, `Image`, `Quote`, `Glossary`, `Video`, `Checkpoint`. Closers: `JoseModule/`, `Section/`, `Lesson/`, `Game/`, `Text/`, `Image/`, `Quote/`, `Glossary/`, `Video/`, `Checkpoint/`. Enforce LIFO stack; unknown open or close → error with line/col. Enforce structure: exactly one top-level `JoseModule`; inside it only `Section` (+ header fields); inside `Section` only `Lesson`/`Game` (+ section header fields); inside `Lesson` only block tags; `Text` body is raw markdown until `Text/`; `Game` body lines: optional `title: ...` first line then strict JSON remainder.

Field parsing: simple `key: value` lines + `objectives:` list (`  - item`). For `Glossary`: lines `- term: X` + `  definition: Y`. Trim, require: module `title(1-80)`, `subtitle(1-160)`, `coverColor` hex; section `title`, `subtitle`, `themeColor` hex; lesson `title`; `Image` needs `src`+`alt`; `Quote` needs `text`+`source`; `Video` needs valid YouTube URL/id + `transcript`; `Glossary` needs ≥1 term/definition; `Text` markdown ≤ `JMM_MAX_TEXT_CHARS` and must pass `UNSAFE_EMBED = /<(?:iframe|script|object|embed)\b|javascript:|data:text\/html/i` + `rejectUnsafeLessonEmbeds` after block assembly; `Game` tag `type` attr must equal JSON `type`, must be in `["quiz","memory","timeline","blank","sort"]` (active types; retired `case-files|dispatches|editorial|dapitan` → error "game type X is retired for import"), JSON byte length ≤ `JMM_MAX_GAME_BYTES`, validated via `gameContentSchema.safeParse(coerceGameContent(json))`.

Duplicate titles: reject duplicate section titles and duplicate level titles within a section only (mirrors editor UX where siblings collide) — error path `sections[i].title` / `levels[j].title`. Counts: sections 1..20, levels per module 1..60, images total ≤30.

Build `JmmPreview`: `{ version: "1", title, subtitle, coverColor, objectives: string[], sections: [{ title, subtitle, themeColor, levels: [{ kind: "lesson"|"game", title, gameType?, blockCount?, blocks?, game? }] }] }` plus `stats { sectionCount, levelCount, imageCount }` and `sourceHash` (FNV-1a hex of source).

Export request/response schemas:

```typescript
export const jmmImportCommitBodySchema = z.object({ source: z.string().min(1).max(JMM_MAX_SOURCE_BYTES) });
export const jmmImportPreviewResponseSchema = z.object({
  ok: z.boolean(),
  preview: jmmPreviewSchema.optional(),
  errors: z.array(jmmErrorSchema),
  stats: z.object({ sectionCount: z.number(), levelCount: z.number(), imageCount: z.number() }).optional(),
});
export const jmmImportCommitResponseSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1),
  sectionCount: z.number(),
  levelCount: z.number(),
  sourceHash: z.string().min(1),
  jmmVersion: z.literal("1"),
});
```

In `packages/shared/src/index.ts` append `export * from "./jose-module-markup";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/shared -- jose-module-markup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/jose-module-markup.ts packages/shared/src/jose-module-markup.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add JMM v1 parser and validator"
```

---

### Task 2: API preview + commit endpoints

**Files:**
- Modify: `apps/api/src/curriculum/curriculum.service.ts:1105-1204,2425-2439`
- Modify: `apps/api/src/curriculum/teach.controller.ts:39-57`
- Test: `apps/api/src/curriculum/module-import.http.spec.ts` (new)

**Interfaces:**
- Consumes: `parseJoseModuleMarkup`, `jmmImportCommitBodySchema`, `JmmPreview` from `@jose/shared`; `runTx`, `audit`, `requireModule`, `getTeachModule` internals; tables `modules`, `sections`, `levels`, `lessonContent`, `gameContent`, `contentAudit`.
- Produces: `previewModuleImport(body: unknown)` → `{ ok, preview?, errors, stats }` with zero DB writes; `commitModuleImport(body: unknown, user: SessionUser)` → `{ moduleId, title, sectionCount, levelCount, sourceHash, jmmVersion }`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/curriculum/module-import.http.spec.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
// bootstrap mirrors content-lifecycle.spec.ts:41-107 (Test app + DatabaseService + createTestAccount)
describe("jmm import", () => {
  it("previews without writing modules", async () => {
    const before = await countModules();
    const res = await http("POST", "/teach/modules/import/preview", { cookie: teacher.cookie, body: { source: MINIMAL_JMM } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(await countModules()).toBe(before);
  });
  it("commits a fresh draft atomically and audits source hash", async () => {
    const res = await http("POST", "/teach/modules/import/commit", { cookie: teacher.cookie, body: { source: MINIMAL_JMM } });
    expect(res.status).toBe(201);
    const detail = await curriculum.getTeachModule(res.body.moduleId);
    expect(detail.published).toBe(false);
    const readiness = await curriculum.getPublishReadiness(res.body.moduleId);
    expect(readiness.ok).toBe(true);
  });
  it("failed import leaves no rows", async () => {
    const before = await countModules();
    const res = await http("POST", "/teach/modules/import/commit", { cookie: teacher.cookie, body: { source: "broken <<<" } });
    expect(res.status).toBe(400);
    expect(await countModules()).toBe(before);
  });
  it("student and other-teacher isolation", async () => {
    // student preview → 403; commit needs owned module so any teacher can commit (creates own) but cannot preview others — assert student 403
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/api -- module-import.http.spec.ts`
Expected: FAIL 404 (no `/teach/modules/import/preview` route) / "previewModuleImport is not a function".

- [ ] **Step 3: Write minimal implementation**

In `curriculum.service.ts` add imports: `parseJoseModuleMarkup`, `jmmImportCommitBodySchema`, `blocksToMarkdown`, `primaryYoutubeIdFromBlocks`, `emptyLessonEditorial`, `simplifyGameContent`, `isActiveGameType`, `isPlayableGameContent`, `createHash` (already imported).

```typescript
previewModuleImport(body: unknown) {
  const data = parseBody(jmmImportCommitBodySchema, body);
  return parseJoseModuleMarkup(data.source);
}

async commitModuleImport(body: unknown, user: SessionUser) {
  const data = parseBody(jmmImportCommitBodySchema, body);
  const parsed = parseJoseModuleMarkup(data.source);
  if (!parsed.ok || !parsed.preview) {
    throw new BadRequestException({ message: "JMM validation failed", errors: parsed.errors });
  }
  const preview = parsed.preview;
  const sourceHash = createHash("sha256").update(data.source).digest("hex");
  const moduleId = randomUUID();
  const t = Date.now();
  const maxSort = await this.maxModuleSort();
  await this.runTx(async (tx) => {
    await tx.insert(modules).values({
      id: moduleId, title: preview.title, subtitle: preview.subtitle,
      coverColor: preview.coverColor, sortOrder: maxSort + 1,
      published: false, featured: false, ownerUserId: user.id,
      createdAt: t, updatedAt: t, revision: 0,
      objectives: preview.objectives.join("\n") || null,
      authorReviewedAt: null, publishedRevisionId: null,
      archivedAt: null, trashedAt: null, status: "draft",
    });
    for (const [si, sec] of preview.sections.entries()) {
      const sectionId = randomUUID();
      await tx.insert(sections).values({
        id: sectionId, moduleId, title: sec.title, subtitle: sec.subtitle,
        themeColor: sec.themeColor, sortOrder: si, archivedAt: null,
      });
      for (const [li, lvl] of sec.levels.entries()) {
        const levelId = randomUUID();
        if (lvl.kind === "lesson") {
          await tx.insert(levels).values({
            id: levelId, sectionId, title: lvl.title, kind: "lesson",
            gameType: null, sortOrder: li, revision: 0, archivedAt: null,
          });
          const blocks = lvl.blocks!;
          await tx.insert(lessonContent).values({
            levelId, markdown: blocksToMarkdown(blocks),
            youtubeVideoId: primaryYoutubeIdFromBlocks(blocks),
            blocksJson: JSON.stringify(blocks),
            editorialJson: JSON.stringify(emptyLessonEditorial()),
          });
        } else {
          await tx.insert(levels).values({
            id: levelId, sectionId, title: lvl.title, kind: "game",
            gameType: lvl.gameType!, sortOrder: li, revision: 0, archivedAt: null,
          });
          await tx.insert(gameContent).values({
            levelId, json: JSON.stringify(simplifyGameContent(lvl.game!)),
          });
        }
      }
    }
    await tx.insert(contentAudit).values({
      id: randomUUID(), moduleId, actorId: user.id,
      action: "module.jmm_import",
      detailJson: JSON.stringify({ jmmVersion: "1", sourceHash, sectionCount: preview.sections.length, sourceBytes: data.source.length }),
      createdAt: Date.now(),
    });
  });
  return { moduleId, title: preview.title, sectionCount: preview.sections.length, levelCount: preview.sections.reduce((n, s) => n + s.levels.length, 0), sourceHash, jmmVersion: "1" as const };
}
```

No `maybeFault` needed inside (single tx rolls back on throw). Do not call `putLesson`/`putGame` (they do extra revisions + active-type gates already enforced by parser).

In `teach.controller.ts` add BEFORE `@Get("modules/:id")`:

```typescript
@Post("modules/import/preview")
previewImport(@Body() body: unknown) {
  return this.curriculum.previewModuleImport(body);
}

@Post("modules/import/commit")
commitImport(@CurrentUser() user: SessionUser, @Body() body: unknown) {
  return this.curriculum.commitModuleImport(body, user);
}
```

Class-level `@UseGuards(SessionAuthGuard, TeacherRoleGuard)` already restricts to teachers/admins; students get 403 automatically.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/api -- module-import.http.spec.ts`
Expected: PASS. Then: `npm run test --workspace=@jose/api -- content-lifecycle.spec.ts` still PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/curriculum/curriculum.service.ts apps/api/src/curriculum/teach.controller.ts apps/api/src/curriculum/module-import.http.spec.ts
git commit -m "feat(api): add JMM preview and atomic commit import"
```

---

### Task 3: Teacher import UI

**Files:**
- Modify: `apps/web/src/lib/path-api.ts:371-383`
- Create: `apps/web/src/components/teach-jmm-import.tsx`
- Test: `apps/web/src/components/teach-jmm-import.test.tsx`
- Create: `apps/web/src/app/teach/modules/import/page.tsx`

**Interfaces:**
- Consumes: `jmmImportPreviewResponseSchema`, `jmmImportCommitResponseSchema` from `@jose/shared`; `apiFetch` from `path-api:62-128`; `runMutation` from `teach-mutations:5-11`.
- Produces: `previewModuleImport(source)`, `commitModuleImport(source)`; `<TeachJmmImport />` with paste area + Validate + outline + confirm.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/teach-jmm-import.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TeachJmmImport } from "./teach-jmm-import";

describe("teach jmm import", () => {
  it("shows validation errors without committing", async () => {
    const onCommit = vi.fn();
    render(<TeachJmmImport previewAction={async () => ({ ok: false, errors: [{ message: "Unknown tag", line: 3, column: 1 }] })} commitAction={onCommit} />);
    fireEvent.change(screen.getByLabelText(/paste jmm/i), { target: { value: "<<<Fancy>>>" } });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));
    await waitFor(() => expect(screen.getByText(/unknown tag/i)).toBeInTheDocument());
    expect(onCommit).not.toHaveBeenCalled();
  });
  it("shows read-only outline and confirms create-draft", async () => {
    const commitAction = vi.fn(async () => ({ moduleId: "m1", title: "T", sectionCount: 1, levelCount: 1, sourceHash: "h", jmmVersion: "1" as const }));
    render(<TeachJmmImport previewAction={async () => ({ ok: true, errors: [], preview: { version: "1", title: "T", subtitle: "S", coverColor: "#22C55E", objectives: [], sections: [{ title: "Sec", subtitle: "Sub", themeColor: "#38BDF8", levels: [{ kind: "lesson", title: "L1" }] }] }, stats: { sectionCount: 1, levelCount: 1, imageCount: 0 } })} commitAction={commitAction} />);
    fireEvent.change(screen.getByLabelText(/paste jmm/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));
    await waitFor(() => expect(screen.getByText("Sec")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));
    await waitFor(() => expect(commitAction).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/web -- teach-jmm-import`
Expected: FAIL "TeachJmmImport is not defined" / module not found.

- [ ] **Step 3: Write minimal implementation**

`path-api.ts`:

```typescript
export async function previewModuleImport(source: string) {
  const json = await apiFetch("/teach/modules/import/preview", { method: "POST", body: JSON.stringify({ source }) });
  return jmmImportPreviewResponseSchema.parse(json);
}
export async function commitModuleImport(source: string) {
  const json = await apiFetch("/teach/modules/import/commit", { method: "POST", body: JSON.stringify({ source }) });
  return jmmImportCommitResponseSchema.parse(json);
}
```

`teach-jmm-import.tsx` (~220 lines): props `{ previewAction = previewModuleImport, commitAction = commitModuleImport }` for test injection. State: `source`, `result`, `busy`, `error`, `created`. Render: `<label htmlFor="jmm-source">Paste JMM</label><textarea id="jmm-source" rows={16} />` (no `useEffect` autosave, no debounce fetch), Validate button → `runMutation(() => previewAction(source))`, error list `<ul>` with `Line X, col Y: message`, read-only outline `<ol>` of sections/levels (no contentEditable), Create draft button disabled unless `result?.ok`, confirm via `window.confirm("Create one new draft module? This never edits existing modules.")`, success shows Next Link `/teach/modules/${moduleId}`. Footer link `<a href="/docs/authoring/jose-module-markup-v1">Authoring guide</a>` — use plain anchor to docs path (served as static doc link; page also links to `/teach/modules/import` guide section).

`app/teach/modules/import/page.tsx`:

```tsx
import { TeachJmmImport } from "@/components/teach-jmm-import";
import { TeachTitle } from "@/components/teach-shell";
export const dynamic = "force-dynamic";
export default function ImportModulePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle kicker="Teach" title="Import module" action={<a className="jose-button jose-button--secondary" href="/docs/authoring/jose-module-markup-v1.md">Authoring guide</a>} />
      <TeachJmmImport />
    </div>
  );
}
```

Add Import link to `app/teach/page.tsx` action row: `<Link href="/teach/modules/import">Import</Link>` alongside Create module.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/web -- teach-jmm-import`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/path-api.ts apps/web/src/components/teach-jmm-import.tsx apps/web/src/components/teach-jmm-import.test.tsx apps/web/src/app/teach/modules/import/page.tsx apps/web/src/app/teach/page.tsx
git commit -m "feat(web): add JMM import page with preview and confirm"
```

---

### Task 4: Authoring guide + LLM prompt

**Files:**
- Create: `docs/authoring/jose-module-markup-v1.md`

**Interfaces:**
- Consumes: `emptyGameContent("quiz"|"memory"|"timeline"|"blank"|"sort")` outputs from `packages/shared/src/games.ts:458-567`, `lessonBlockSchema` field requirements from `packages/shared/src/lesson-blocks.ts:7-59`, `JMM_*` limits from Task 1.
- Produces: grammar + full examples + error examples + copy-paste LLM prompt.

- [ ] **Step 1: Write the failing test** (docs presence + game coverage gate)

```typescript
// packages/shared/src/jose-module-markup.test.ts (append)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
it("ships an authoring guide covering every active game type", () => {
  const p = join(__dirname, "..", "..", "..", "docs", "authoring", "jose-module-markup-v1.md");
  expect(existsSync(p)).toBe(true);
  const doc = readFileSync(p, "utf8");
  for (const t of [`type="quiz"`, `type="memory"`, `type="timeline"`, `type="blank"`, `type="sort"`]) {
    expect(doc).toContain(t);
  }
  expect(doc).toMatch(/never invent citations/i);
  expect(doc).toMatch(/alt text/i);
  expect(doc).toMatch(/transcript/i);
  expect(doc).toMatch(/raw HTML/i);
});
```

Run first: FAIL (file missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/shared -- jose-module-markup.test.ts -t "authoring guide"`
Expected: FAIL `existsSync` false.

- [ ] **Step 3: Write minimal implementation**

Create `docs/authoring/jose-module-markup-v1.md` (~350 lines): sections — Overview (JMM v1 fenced text, Markdown only inside Text), Envelope grammar (case-sensitive, LIFO, unknown tags error, top-level 1 JoseModule → 1..20 Section → 1..60 Lesson/Game), Field reference table per tag (required/optional + limits), Five full Game JSON examples generated from `emptyGameContent` (paste real minimal valid JSON for quiz/memory/timeline/blank/sort — do not invent fields), Image/Quote/Glossary/Video/Checkpoint examples, Error examples with line/col (mismatched close, unknown tag, bad JSON, missing alt, bad YouTube URL, oversized), Limits table, Import flow (validate→preview→create draft→review→publish readiness), Ready-to-copy LLM prompt block requiring source citations, accessible alt, video transcripts, valid JSON, never invent citations or raw HTML.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/shared -- jose-module-markup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/authoring/jose-module-markup-v1.md packages/shared/src/jose-module-markup.test.ts
git commit -m "docs: add JMM v1 authoring guide and LLM prompt"
```

---

### Task 5: End-to-end publish-after-import regression

**Files:**
- Modify: `apps/api/src/curriculum/module-import.http.spec.ts` (extend Task 2 file)

**Interfaces:**
- Consumes: `CurriculumService.commitModuleImport`, `getPublishReadiness`, `publishModule` from `curriculum.service.ts:1975-2011`; HTTP helpers from spec bootstrap.

- [ ] **Step 1: Write the failing test**

```typescript
it("imported draft previews correctly and publishes after readiness", async () => {
  const commit = await http("POST", "/teach/modules/import/commit", { cookie: teacher.cookie, body: { source: FULL_JMM_WITH_QUIZ } });
  expect(commit.status).toBe(201);
  const detail = await http("GET", `/teach/modules/${commit.body.moduleId}`, { cookie: teacher.cookie });
  expect(detail.status).toBe(200);
  expect(detail.body.published).toBe(false);
  const readiness = await http("GET", `/teach/modules/${commit.body.moduleId}/readiness`, { cookie: teacher.cookie });
  // FULL_JMM must include objectives + ≥40-char lesson markdown + valid quiz so readiness.ok is true after authorReviewed
  await http("PATCH", `/teach/modules/${commit.body.moduleId}`, { cookie: teacher.cookie, body: { authorReviewed: true, objectives: "Explain the movement" } });
  const pub = await http("POST", `/teach/modules/${commit.body.moduleId}/publish`, { cookie: teacher.cookie, body: { authorReviewed: true } });
  expect(pub.status).toBe(201);
  expect(pub.body.module.published).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/api -- module-import.http.spec.ts -t "publishes after readiness"`
Expected: FAIL (no publish path wired for imported content or readiness blocker).

- [ ] **Step 3: Write minimal implementation**

No new production code expected — fix gaps only: ensure `objectives` from JMM (`preview.objectives.join("\n")`) satisfies `assessPublishReadiness` objectives check; ensure lesson markdown from `blocksToMarkdown` is ≥40 chars (JMM validator already requires non-empty markdown; extend `FULL_JMM_WITH_QUIZ` fixture to 2 paragraphs); ensure quiz JSON uses `correctChoiceId` matching choice id (validator enforces). If readiness still blocks, surface `readiness.blockers` in test output and adjust fixture, not the readiness rules.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/api -- module-import.http.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/curriculum/module-import.http.spec.ts
git commit -m "test(api): cover import-to-publish happy path"
```

---

### Task 6: Verification gate

- [ ] **Step 1: Run focused tests**

Run: `npm run test --workspace=@jose/shared -- jose-module-markup.test.ts`
Run: `npm run test --workspace=@jose/api -- module-import.http.spec.ts`
Run: `npm run test --workspace=@jose/web -- teach-jmm-import`
Expected: all PASS.

- [ ] **Step 2: Run full gates**

Run: `npm test`
Run: `npm run lint`
Run: `npm run build`
Expected: `npm test` PASS; `npm run lint` 0 errors; `npm run build` exit 0 for all three workspaces.

- [ ] **Step 3: Commit verification note** (no code change; record commands + results in handoff reply, do not claim unrun checks).

---

## Self-Review

1. **Spec coverage:** Parser + line/col errors + Zod reuse → Task 1. Preview no-write + atomic commit + audit with version/hash → Task 2. Paste area + validation list + read-only outline + confirm + guide link + no autosave → Task 3. Guide with every active game format + error examples + LLM prompt (citations/alt/transcript/valid JSON, never invent/HTML) → Task 4. Draft→preview→publish e2e + no-rows-on-failure → Task 5.
2. **Placeholder scan:** No TBD/TODO; every step has concrete file paths, code blocks, run commands, expected outputs.
3. **Type consistency:** `JmmPreview` field names match service insert mapping, controller passthrough, `path-api` parser, and UI outline cells. `sourceHash`/`jmmVersion` names match audit detail JSON and commit response schema.

