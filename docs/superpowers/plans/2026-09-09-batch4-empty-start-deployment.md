# Batch 4 Empty Start and Deployment Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an empty, deployable Jose release with no production seed path, a guarded empty-start workflow, full backup coverage, production env template, and Vercel plus self-hosted API deployment docs.

**Architecture:** Retire only the production seed entry point while keeping `seed.ts` as a deprecated test fixture; add a heavily guarded `db:empty` CLI that never auto-runs; add a non-destructive `013_empty_start` migration marker with safe backfill; expand logical backup table coverage; add root `.env.production.example` and ops docs.

**Tech Stack:** Next.js 16 rewrite proxy, NestJS + Drizzle + libSQL (file and Turso `libsql://`), TypeScript, Jest, ts-node CLIs, Turborepo.

**Spec:** `docs/reviews/2026-09-09-overall-audit-cursor-handoff.md` Batch 4 section (lines 191-197) plus Required product rules and Cursor master prompt constraints in the same file.

## Global Constraints

- Stay on the `ui` branch; do not create a new branch or worktree unless the user explicitly asks.
- Keep the existing Next.js + NestJS + shared Zod + libSQL architecture.
- Do not replace Drizzle, authentication, assessment scoring, migrations, or content revisions.
- Do not deploy, alter a real database, send real email, hard-code authorization based on an email address, or delete data.
- Preserve unrelated working-tree changes.
- Keep all secrets server-only; never expose Turso token, OAuth secret, or session secret as `NEXT_PUBLIC_*`.
- Do not delete migrations, backup, restore, production migration checks, or content revision support.
- `db:empty` must never run automatically on startup or in deployment; it requires an explicit database URL, an exact confirmation phrase, and a preflight backup.
- Code must not erase a database merely because it has no modules.
- A clean `npm run lint` is a required completion check.
- Run the focused tests first, then `npm test`, lint, and production build if time permits; report exact commands and results.

---

### Task 1: Retire production seed entry, keep test fixtures green

**Files:**
- Modify: `package.json:8-21` (remove `db:seed` script)
- Modify: `apps/api/package.json:5-14` (remove `db:seed` script, add `db:empty` in Task 2)
- Delete: `apps/api/src/db/seed-cli.ts`
- Modify: `apps/api/src/db/seed.ts:1-30` (add deprecation header, no logic change)
- Modify: `README.md:36-53` (remove seed commands, point to empty-start doc)
- Modify: `.gitignore:33-36` (fix stale seeded comment)
- Modify: `docs/CONTENT_GAPS.md:1-8` (remove seeded-course framing)

**Interfaces:**
- Consumes: existing `applyPendingSeeds(db, { includeDemo })` used by 8 spec files; existing `seedHistory` table from `migration001InitialSchema`.
- Produces: `seed.ts` remains importable by tests with identical exports `SEED_IDS`, `applyPendingSeeds`; no `db:seed` CLI remains; docs point to `docs/ops/empty-start-and-cutover.md` (created in Task 5).

- [ ] **Step 1: Write the failing test (prove no production seed script remains)**

```ts
// apps/api/src/db/seed-retired.spec.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("production seed entry retired", () => {
  it("has no db:seed script in root or api package.json", () => {
    const root = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "..", "package.json"), "utf8"),
    );
    const api = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"),
    );
    expect(root.scripts?.["db:seed"]).toBeUndefined();
    expect(api.scripts?.["db:seed"]).toBeUndefined();
  });

  it("has no seed-cli.ts on disk", () => {
    expect(() => {
      readFileSync(join(__dirname, "seed-cli.ts"), "utf8");
    }).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./jest.config.ts src/db/seed-retired.spec.ts`
Expected: FAIL with `db:seed` still defined and `seed-cli.ts` still readable.

- [ ] **Step 3: Remove production seed wiring**

```json
// package.json scripts: delete this line
// BEFORE: "db:seed": "npm run db:seed --workspace=@jose/api",
```

```json
// apps/api/package.json scripts: delete this line
// BEFORE: "db:seed": "ts-node --transpile-only src/db/seed-cli.ts",
```

Delete file `apps/api/src/db/seed-cli.ts` via filesystem delete.

Prepend to `apps/api/src/db/seed.ts` line 1:

```ts
/**
 * @deprecated Test fixtures only. There is no production `db:seed` command.
 * Empty start uses a fresh migrated database; see docs/ops/empty-start-and-cutover.md.
 * Kept because 8 http/service specs use applyPendingSeeds for isolated fixtures
 * and existing deployments may still carry seed_history rows. Do not import
 * from application runtime code.
 */
```

Update `README.md` lines 36-43 from:

```md
The API creates `apps/api/data/jose.sqlite` on first boot but does **not** insert curriculum or demo progress automatically. After a fresh database (or deploy), seed explicitly:

```bash
npm run db:seed                 # curriculum@1 only — honest empty learner stats
npm run db:seed -- --demo       # also apply demo-learner@1 (local shared Explorer only)
```

Re-running the seed command skips already-applied versions, so deleting a seeded extra or the Ateneo module survives restart. `JOSE_DEMO_MODE` never invents XP for a signed-in student; production refuses to boot with it enabled.
```

to:

```md
The API creates `apps/api/data/jose.sqlite` on first boot and never inserts
curriculum or demo progress. A fresh migrated database is the empty start —
teachers create modules via Teacher studio or JMM import afterwards:

```bash
npm run db:migrate
```

See `docs/ops/empty-start-and-cutover.md` for the clean-start and Turso
cutover procedure. `JOSE_DEMO_MODE` never invents XP for a signed-in student;
production refuses to boot with it enabled.
```

Update `.gitignore` line 33 from `# Local SQLite (seeded on API boot)` to `# Local SQLite (created on API boot, never seeded)`.

Update `docs/CONTENT_GAPS.md` lines 1-4 from `The student-learning batch (#25–#31) ships **editorial structures** only. Do **not** treat seeded Markdown as a complete APC RIZLIFE course.` to `Teacher-created modules ship **editorial structures** only. Do **not** treat any starter Markdown as a complete APC RIZLIFE course. There is no production seed course; instructors author via Teacher studio or JMM import.`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config ./jest.config.ts src/db/seed-retired.spec.ts`
Expected: PASS.

Run: `npx jest --config ./jest.config.ts src/db/seed.spec.ts`
Expected: PASS (fixtures still work).

- [ ] **Step 5: Commit**

```bash
git add package.json apps/api/package.json apps/api/src/db/seed.ts README.md .gitignore docs/CONTENT_GAPS.md apps/api/src/db/seed-retired.spec.ts
git rm apps/api/src/db/seed-cli.ts
git commit -m "chore(db): retire production db:seed, keep test fixtures"
```

---

### Task 2: Guarded empty-start workflow (db:empty, never automatic)

**Files:**
- Create: `apps/api/src/db/empty.ts`
- Create: `apps/api/src/db/empty-cli.ts`
- Create: `apps/api/src/db/empty.spec.ts`
- Modify: `apps/api/package.json:5-14` (add `db:empty` script)
- Modify: `package.json:8-21` (add root `db:empty` passthrough)

**Interfaces:**
- Consumes: `openDatabaseClient(url)`, `resolveDatabaseUrl()` from `./database.service`; `runMigrations(client)` from `./migrate`; `writeLogicalBackup(client, url, path)` from `./backup`.
- Produces: `EMPTY_CONFIRM_PHRASE = "EMPTY-JOSE-DATABASE"`; `assertEmptyAllowed(opts)` throws on missing URL, wrong phrase, remote without explicit allow, or production without explicit allow; `emptyDatabase(client)` deletes child-before-parent rows, preserves `schema_migrations`, vacuums, re-runs migrations.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/db/empty.spec.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "./migrate";
import { EMPTY_CONFIRM_PHRASE, assertEmptyAllowed, emptyDatabase } from "./empty";
import * as schema from "./schema";
import { learners } from "./schema";

function openTmp() {
  const dir = mkdtempSync(join(tmpdir(), "jose-empty-"));
  const path = join(dir, "t.sqlite").replace(/\\/g, "/");
  const url = `file:${path}`;
  const client = createClient({ url });
  return { client, db: drizzle(client, { schema }), url, dir };
}

describe("guarded empty", () => {
  it("requires the exact confirmation phrase", async () => {
    const opened = openTmp();
    try {
      await expect(
        assertEmptyAllowed({
          databaseUrl: opened.url,
          confirm: "yes",
          allowRemote: false,
          isProduction: false,
        }),
      ).rejects.toThrow(/EMPTY-JOSE-DATABASE/);
    } finally {
      opened.client.close();
    }
  });

  it("refuses remote libsql without explicit allow", async () => {
    await expect(
      assertEmptyAllowed({
        databaseUrl: "libsql://demo.turso.io",
        confirm: EMPTY_CONFIRM_PHRASE,
        allowRemote: false,
        isProduction: false,
      }),
    ).rejects.toThrow(/remote/i);
  });

  it("empties a file database but preserves migrations", async () => {
    const opened = openTmp();
    try {
      await runMigrations(opened.client);
      await opened.db.insert(learners).values({
        id: "keep-me-not",
        displayName: "Zed",
        streak: 0,
        hearts: 5,
        heartsUpdatedAt: 0,
        xp: 0,
      });
      await assertEmptyAllowed({
        databaseUrl: opened.url,
        confirm: EMPTY_CONFIRM_PHRASE,
        allowRemote: false,
        isProduction: false,
      });
      await emptyDatabase(opened.client);
      const rows = await opened.db.select().from(learners);
      expect(rows).toHaveLength(0);
      const applied = await opened.client.execute("SELECT id FROM schema_migrations");
      expect(applied.rows.length).toBeGreaterThan(0);
    } finally {
      opened.client.close();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./jest.config.ts src/db/empty.spec.ts`
Expected: FAIL with `Cannot find module './empty'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/db/empty.ts
import type { Client } from "@libsql/client";
import { runMigrations } from "./migrate";

export const EMPTY_CONFIRM_PHRASE = "EMPTY-JOSE-DATABASE";

export type EmptyGuardOptions = {
  databaseUrl: string;
  confirm: string;
  allowRemote: boolean;
  isProduction: boolean;
  allowProduction?: boolean;
};

function isRemote(url: string): boolean {
  return url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("wss://");
}

export async function assertEmptyAllowed(opts: EmptyGuardOptions): Promise<void> {
  if (!opts.databaseUrl?.trim()) {
    throw new Error("Refusing to empty: JOSE_DATABASE_URL must be set explicitly.");
  }
  if (opts.confirm !== EMPTY_CONFIRM_PHRASE) {
    throw new Error(
      `Refusing to empty: pass --confirm=${EMPTY_CONFIRM_PHRASE} to prove intent.`,
    );
  }
  if (isRemote(opts.databaseUrl) && !opts.allowRemote) {
    throw new Error(
      "Refusing to empty a remote database. Prefer creating a new empty Turso database; re-run with --allow-remote plus JOSE_ALLOW_EMPTY_REMOTE=true if you truly mean it.",
    );
  }
  if (opts.isProduction && !opts.allowProduction) {
    throw new Error(
      "Refusing to empty in production. Set JOSE_ALLOW_EMPTY_PRODUCTION=true plus a preflight backup if a cutover truly requires it.",
    );
  }
}

const CHILD_FIRST_TABLES = [
  "class_challenge_contributions",
  "class_challenge_team_members",
  "class_challenge_participants",
  "class_challenge_teams",
  "class_challenges",
  "invite_attempts",
  "assignments",
  "class_members",
  "classes",
  "mailbox_verifications",
  "pending_admissions",
  "oauth_states",
  "sessions",
  "external_identities",
  "learner_artifacts",
  "learner_achievements",
  "practice_reviews",
  "practice_attempts",
  "learning_misses",
  "miss_receipts",
  "attempts",
  "learner_progress",
  "lesson_life_credits",
  "bookmarks",
  "game_content",
  "lesson_content",
  "levels",
  "teach_assets",
  "sections",
  "content_audit",
  "module_revisions",
  "module_collaborators",
  "modules",
  "learners",
  "users",
  "role_audit",
  "user_name_audit",
  "seed_history",
] as const;

export async function emptyDatabase(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = OFF");
  try {
    for (const table of CHILD_FIRST_TABLES) {
      await client.execute(`DELETE FROM ${table}`).catch(() => undefined);
    }
  } finally {
    await client.execute("PRAGMA foreign_keys = ON");
  }
  await runMigrations(client);
  await client.execute("VACUUM").catch(() => undefined);
}
```

```ts
// apps/api/src/db/empty-cli.ts
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadJoseEnv } from "../config/env";
import { isProductionEnv } from "../auth/auth-config";
import { writeLogicalBackup } from "./backup";
import { openDatabaseClient, resolveDatabaseUrl } from "./database.service";
import { runMigrations } from "./migrate";
import { EMPTY_CONFIRM_PHRASE, assertEmptyAllowed, emptyDatabase } from "./empty";

async function main() {
  loadJoseEnv(process.env);
  const confirm = process.argv.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length) ?? "";
  const backupOut = process.argv.find((a) => a.startsWith("--backup-out="))?.slice("--backup-out=".length);
  const allowRemote =
    process.argv.includes("--allow-remote") && process.env.JOSE_ALLOW_EMPTY_REMOTE === "true";
  const allowProduction = process.env.JOSE_ALLOW_EMPTY_PRODUCTION === "true";
  const url = resolveDatabaseUrl();
  if (!process.env.JOSE_DATABASE_URL?.trim()) {
    throw new Error("Refusing to empty: JOSE_DATABASE_URL must be set explicitly (no default).");
  }
  await assertEmptyAllowed({
    databaseUrl: url,
    confirm,
    allowRemote,
    isProduction: isProductionEnv(process.env),
    allowProduction,
  });
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length);
    if (p && p !== ":memory:") await mkdir(dirname(p), { recursive: true });
  }
  const client = openDatabaseClient(url);
  try {
    await runMigrations(client);
    const dest = backupOut ?? `data/backups/pre-empty-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await writeLogicalBackup(client, url, dest);
    console.log(`preflight backup: ${dest}`);
    await emptyDatabase(client);
    console.log(`emptied ${url} (confirm=${EMPTY_CONFIRM_PHRASE}); migrations re-applied; backup at ${dest}`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

Add scripts:

```json
// apps/api/package.json
"db:empty": "ts-node --transpile-only src/db/empty-cli.ts",
```

```json
// package.json
"db:empty": "npm run db:empty --workspace=@jose/api",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config ./jest.config.ts src/db/empty.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/empty.ts apps/api/src/db/empty-cli.ts apps/api/src/db/empty.spec.ts apps/api/package.json package.json
git commit -m "feat(db): add guarded db:empty with preflight backup"
```

---

### Task 3: Non-destructive empty-start migration 013

**Files:**
- Modify: `apps/api/src/db/migrations/index.ts:595-608` (append `migration013EmptyStart`, add to `MIGRATIONS`)
- Modify: `apps/api/src/db/migrate.spec.ts:139-143` (assert 013 applied, assert no data loss)

**Interfaces:**
- Consumes: `ensureColumn(client, table, column, definition)` helper; existing `MIGRATIONS` array order.
- Produces: `migration013EmptyStart.id = "013_empty_start"`; backfills `modules.status` where NULL; never deletes rows.

- [ ] **Step 1: Write the failing test**

```ts
it("applies the empty-start release without erasing student records", async () => {
  const dir = mkdtempSync(join(rootDir, "emptystart-"));
  const path = join(dir, "s.sqlite");
  const { client, db } = open(path);
  await createLegacyDatabase(client);
  await client.execute({
    sql: `INSERT INTO learners (id, display_name, streak, hearts, hearts_updated_at, xp) VALUES (?, ?, ?, ?, ?, ?)`,
    args: ["learner-keep", "Ana", 2, 3, 1, 40],
  });
  await runMigrations(client);
  const applied = await listAppliedMigrations(client);
  expect(applied).toContain("013_empty_start");
  const [learner] = await db.select().from(learners).where(eq(learners.id, "learner-keep"));
  expect(learner?.xp).toBe(40);
  const emptyCheck = await db.select().from(learners);
  expect(emptyCheck.length).toBeGreaterThan(0);
  client.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./jest.config.ts src/db/migrate.spec.ts -t "empty-start"`
Expected: FAIL with `013_empty_start` missing.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Empty-start release marker. Non-destructive: backfills module status for
 * pre-release rows so fresh and upgraded databases agree. Never deletes
 * curriculum, users, learners, attempts, or history. An empty database after
 * this migration means "no modules yet", not "wiped".
 */
export const migration013EmptyStart: Migration = {
  id: "013_empty_start",
  async up(client) {
    await client.execute("PRAGMA foreign_keys = ON");
    await ensureColumn(client, "modules", "status", "TEXT");
    await client.execute(
      `UPDATE modules SET status = CASE WHEN published = 1 THEN 'published' ELSE 'draft' END WHERE status IS NULL`,
    ).catch(() => undefined);
  },
};
```

Append `migration013EmptyStart` to `MIGRATIONS` after `migration012GradebookIndexes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config ./jest.config.ts src/db/migrate.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrations/index.ts apps/api/src/db/migrate.spec.ts
git commit -m "feat(db): add non-destructive 013_empty_start migration"
```

---

### Task 4: Full backup coverage for cutover safety

**Files:**
- Modify: `apps/api/src/db/backup.ts:13-42` (expand `TABLE_ORDER` to every table in `schema.ts`)
- Modify: `apps/api/src/db/migrate.spec.ts:204-215` (assert manifest covers all tables)

**Interfaces:**
- Consumes: table names from `apps/api/src/db/schema.ts` (`sqliteTable("…")` first args).
- Produces: `exportLogicalBackup` returns non-empty keys for `module_revisions`, `content_audit`, `assignments`, `practice_attempts`, `role_audit`, `user_name_audit`, `learner_artifacts`, and all other tables; `restoreLogicalBackup` round-trips them.

- [ ] **Step 1: Write the failing test**

```ts
const manifest = await exportLogicalBackup(source.client, source.url);
for (const table of ["module_revisions", "content_audit", "assignments", "practice_attempts", "practice_reviews", "learner_achievements", "learner_artifacts", "learning_misses", "teach_assets", "role_audit", "user_name_audit", "invite_attempts"]) {
  expect(Object.keys(manifest.tables)).toContain(table);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./jest.config.ts src/db/migrate.spec.ts -t "logical backup"`
Expected: FAIL with `module_revisions` missing from manifest keys.

- [ ] **Step 3: Write minimal implementation**

Replace `TABLE_ORDER` in `apps/api/src/db/backup.ts` with:

```ts
const TABLE_ORDER = [
  "schema_migrations",
  "seed_history",
  "users",
  "learners",
  "modules",
  "module_revisions",
  "content_audit",
  "module_collaborators",
  "sections",
  "levels",
  "lesson_content",
  "game_content",
  "teach_assets",
  "learner_progress",
  "attempts",
  "practice_attempts",
  "practice_reviews",
  "learning_misses",
  "miss_receipts",
  "learner_achievements",
  "learner_artifacts",
  "bookmarks",
  "lesson_life_credits",
  "external_identities",
  "sessions",
  "oauth_states",
  "pending_admissions",
  "mailbox_verifications",
  "classes",
  "class_members",
  "assignments",
  "class_challenges",
  "class_challenge_teams",
  "class_challenge_team_members",
  "class_challenge_participants",
  "class_challenge_contributions",
  "invite_attempts",
  "role_audit",
  "user_name_audit",
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config ./jest.config.ts src/db/migrate.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/backup.ts apps/api/src/db/migrate.spec.ts
git commit -m "fix(db): cover all tables in logical backup and restore"
```

---

### Task 5: Production env template plus deployment and cutover docs

**Files:**
- Create: `.env.production.example`
- Create: `docs/ops/deployment.md`
- Create: `docs/ops/empty-start-and-cutover.md`
- Modify: `docs/ops/staging-smoke-and-rollback.md:1-13` (link new docs, add CSV/logout checks)
- Modify: `README.md:53-54,105-119` (point to deployment doc, drop seed wording)
- Modify: `apps/web/.env.example:1-7` (clarify server-only rewrite target)

**Interfaces:**
- Consumes: `apps/api/src/config/env.ts` required keys; `apps/api/src/auth/auth-config.ts` production rejects; `apps/web/next.config.ts` rewrite via `JOSE_INTERNAL_API_URL`.
- Produces: copy-pasteable production template with no `NEXT_PUBLIC_*` secrets; ordered deploy checklist (Turso create/backup, API secrets, `db:migrate`, `/ready`, Vercel rewrite, web deploy, login/teacher/CSV/logout verify).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/config/prod-env-template.spec.ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("production env template", () => {
  it("exists and keeps secrets server-only", () => {
    const p = join(__dirname, "..", "..", "..", "..", ".env.production.example");
    expect(existsSync(p)).toBe(true);
    const text = readFileSync(p, "utf8");
    expect(text).toMatch(/JOSE_DATABASE_URL=libsql:\/\//);
    expect(text).toMatch(/JOSE_DATABASE_AUTH_TOKEN=/);
    expect(text).toMatch(/JOSE_INTERNAL_API_URL=/);
    expect(text).toMatch(/JOSE_WEB_ORIGIN=https:\/\//);
    expect(text).not.toMatch(/NEXT_PUBLIC_JOSE_DATABASE_AUTH_TOKEN/);
    expect(text).not.toMatch(/NEXT_PUBLIC_JOSE_SESSION_SECRET/);
    expect(text).not.toMatch(/NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./jest.config.ts src/config/prod-env-template.spec.ts`
Expected: FAIL with `.env.production.example` missing.

- [ ] **Step 3: Write minimal implementation**

Create `.env.production.example` at repo root:

```bash
# Jose production template. Copy values into the host (Vercel env, API host secrets).
# Never prefix secrets with NEXT_PUBLIC_* — the browser bundle must not see them.

# --- API database (Turso preferred, persistent volume file: also allowed) ---
JOSE_DATABASE_URL=libsql://your-db.turso.io
JOSE_DATABASE_AUTH_TOKEN=replace-with-turso-auth-token

# --- API origins and proxy ---
JOSE_WEB_ORIGIN=https://jose.your-school.edu
JOSE_ALLOWED_ORIGINS=https://jose.your-school.edu
JOSE_API_PUBLIC_URL=https://api.your-school.edu
JOSE_TRUST_PROXY=1
JOSE_MAX_BODY_BYTES=65536

# --- API auth (Microsoft only in production) ---
JOSE_AUTH_MODE=microsoft
JOSE_SESSION_SECRET=replace-with-32-plus-char-random-secret
JOSE_COOKIE_SECURE=true
JOSE_MICROSOFT_CLIENT_ID=replace-with-entra-app-id
JOSE_MICROSOFT_CLIENT_SECRET=replace-with-entra-client-secret
JOSE_MICROSOFT_TENANT=common
JOSE_MICROSOFT_REDIRECT_URI=https://jose.your-school.edu/api/auth/microsoft/callback

# --- Web (Vercel, server-only rewrite target; no secret here) ---
JOSE_INTERNAL_API_URL=https://api.your-school.edu
# NEXT_PUBLIC_API_URL must stay unset so the browser uses same-origin /api.

# --- One-time ops (set only for the bootstrap/promotion minute, then delete) ---
# JOSE_ADMIN_BOOTSTRAP_EMAIL=dean@apc.edu.ph
# JOSE_ADMIN_BOOTSTRAP_TOKEN=replace-once-then-delete
# JOSE_PROMOTE_ARLAUS_TOKEN=replace-once-then-delete

# Production refuses to boot with JOSE_AUTH_MODE=mock|disabled, JOSE_DEMO_MODE=true,
# or JOSE_MAIL_TRANSPORT=memory with microsoft mode. Local dev shortcuts were deleted.
```

Create `docs/ops/deployment.md` with Vercel web plus self-hosted API order, required secrets, `db:migrate` against Turso, `/ready` gate, rewrite target, and verify steps (login, teacher-only 403 check, CSV export, logout). Create `docs/ops/empty-start-and-cutover.md` with preferred new-empty-Turso-DB flow, backup before any cutover, `013_empty_start` notes, guarded `db:empty` local-only usage with exact phrase, and rollback via logical backup restore.

Update `docs/ops/staging-smoke-and-rollback.md` pre-deploy list to link both new docs and add to smoke checklist:

```md
- Teacher `Download CSV` for one assignment returns headers plus safe cells
- Logout revokes `jose_session` and `/teach/*` returns 401 afterwards
```

Update `README.md` Before-deploying section to link `docs/ops/deployment.md` and `.env.production.example`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config ./jest.config.ts src/config/prod-env-template.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .env.production.example docs/ops/deployment.md docs/ops/empty-start-and-cutover.md docs/ops/staging-smoke-and-rollback.md README.md apps/web/.env.example apps/api/src/config/prod-env-template.spec.ts
git commit -m "docs(ops): add production env template and deployment cutover guides"
```
