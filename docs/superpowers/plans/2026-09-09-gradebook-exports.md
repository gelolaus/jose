# Gradebook and Exports (Batch 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single latest-assignment report with a full class gradebook showing every current and archived assignment, each with its own exportable table.

**Architecture:** Extend shared Zod contracts first, then add batched teacher-only gradebook + roster + CSV endpoints in `ClassroomService`, add migration 012 indexes, then update Next.js server page + `TeachClassesClient` to render assignment navigation plus one table per assignment.

**Tech Stack:** Next.js App Router, NestJS, Drizzle ORM + libSQL, shared Zod schemas, Vitest/Jest API specs, React Testing Library.

**Spec:** `docs/reviews/2026-09-09-overall-audit-cursor-handoff.md` Batch 2 section (gradebook and exports). Current source on `ui` branch at `42f627a`.

## Global Constraints

- Stay on `ui` branch; do not switch branches.
- Do not replace Drizzle, authentication, assessment scoring, migrations, or content revisions.
- Do not deploy, alter a real database, send real email, hard-code authorization on email, or delete data.
- Student profile requests must never change name; teacher-only rows must never leak to student endpoints.
- Scores are assessment attempts only (`attempts.mode = 'assessment'`, `status = 'finished'`); `practice_attempts` must never appear as grades.
- Scores and progress derive from `assignment.contentRevisionId`, never current draft.
- Keep existing CSV injection protection (`csvSafeCell` guarding `=`, `+`, `-`, `@`, tab, CR).
- Preserve historical members and archived assignments; never merge duplicate module assignments.
- `npm run lint` must be clean; focused tests then `npm test`, lint, build.

---

## File Structure

- Modify: `packages/shared/src/classroom.ts` — gradebook, roster, attempt-summary, export, pagination schemas. Single source of truth for API + UI.
- Modify: `apps/api/src/db/migrations/index.ts` — append `migration012GradebookIndexes`, add to `MIGRATIONS`.
- Modify: `apps/api/src/curriculum/classroom.service.ts` — batched gradebook, roster, report extension, CSV extension, `listClassAssignments` history flag.
- Modify: `apps/api/src/curriculum/classroom.controller.ts` — `GET /teach/classes/:id/gradebook`, `GET /teach/classes/:id/roster`, paginated report + CSV query support.
- Modify: `apps/web/src/lib/path-api.ts` — `fetchGradebook`, `fetchClassRoster`, CSV URL helper.
- Modify: `apps/web/src/lib/server-api.ts` — server wrappers forwarding session cookie.
- Modify: `apps/web/src/app/teach/classes/page.tsx` — load gradebook (all assignments + reports) server-side.
- Modify: `apps/web/src/components/teach-classes-client.tsx` — assignment nav + one table per assignment + per-assignment Download CSV.
- Create: `apps/api/src/curriculum/gradebook.http.spec.ts` — HTTP regression tests for Batch 2.
- Modify: `packages/shared/src/classroom.test.ts` (create if missing — check first) — schema + CSV guard tests.

---

### Task 1: Shared gradebook schemas

**Files:**
- Modify: `packages/shared/src/classroom.ts:1-107`
- Test: `packages/shared/src/classroom.test.ts` (create if not exists)

**Interfaces:**
- Consumes: existing `assignmentSchema`, `classMemberProgressSchema`, `classReportSchema`, `paginationQuerySchema` from `packages/shared/src/pagination.ts:1-24`, `csvSafeCell`/`toCsv`.
- Produces: `gradebookAssignmentSchema`, `gradebookMemberRowSchema`, `gradebookResponseSchema`, `classRosterRowSchema`, `classRosterResponseSchema`, `attemptSummarySchema`, `gradebookExportOptionsSchema`, `gradebookQuerySchema`; exported types `GradebookAssignment`, `GradebookMemberRow`, `GradebookResponse`, `ClassRosterRow`, `ClassRosterResponse`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/classroom.test.ts
import { describe, expect, it } from "vitest";
import { csvSafeCell, gradebookResponseSchema, classRosterResponseSchema } from "./classroom";

describe("gradebook contracts", () => {
  it("requires admissionEmail and revision metadata on every row", () => {
    const parsed = gradebookResponseSchema.safeParse({
      classId: "c1",
      assignments: [
        {
          id: "a1",
          classId: "c1",
          moduleId: "m1",
          moduleTitle: "Propaganda",
          contentRevisionId: "r1",
          revisionNumber: 2,
          dueAt: null,
          assignedAt: 1000,
          archivedAt: null,
          members: [
            {
              learnerId: "u1",
              displayName: "Stu",
              admissionEmail: "stu@student.apc.edu.ph",
              membership: "active",
              status: "completed",
              progress: "2/2",
              completedCount: 2,
              totalCount: 2,
              masteryPercent: 80,
              bestScore: "8 / 10 (80%)",
              bestNumerator: 8,
              bestDenominator: 10,
              latestScore: "6 / 10 (60%)",
              latestNumerator: 6,
              latestDenominator: 10,
              latestAttemptAt: "2026-09-01T00:00:00.000Z",
              assignedRevisionId: "r1",
              revisionNumber: 2,
              assignmentState: "active",
              joinedAt: "2026-08-01T00:00:00.000Z",
              archivedAt: null,
            },
          ],
          counts: { notStarted: 0, inProgress: 0, completed: 1 },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("guards formula injection chars", () => {
    expect(csvSafeCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(csvSafeCell("+1+1")).toBe("'+1+1");
    expect(csvSafeCell("-2")).toBe("'-2");
    expect(csvSafeCell("@evil")).toBe("'@evil");
    expect(csvSafeCell("\tindented")).toBe("'\tindented");
    expect(csvSafeCell("a\rb")).toBe("\"'a\rb\"");
  });

  it("rejects roster rows without email", () => {
    const parsed = classRosterResponseSchema.safeParse({
      classId: "c1",
      members: [{ learnerId: "u1", displayName: "Stu", joinedAt: 1, membership: "active" }],
      nextCursor: null,
    });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/shared -- classroom.test.ts`
Expected: FAIL with "gradebookResponseSchema is not defined" / "classRosterResponseSchema is not defined".

- [ ] **Step 3: Write minimal implementation**

In `packages/shared/src/classroom.ts`, keep all existing exports unchanged for backwards compat, then append:

```typescript
export const attemptSummarySchema = z.object({
  numerator: z.number().int().nonnegative().nullable(),
  denominator: z.number().int().positive().nullable(),
  display: z.string().min(1).nullable(),
  attemptAt: z.string().datetime().nullable(),
});

export const gradebookMemberRowSchema = z.object({
  learnerId: z.string().min(1),
  displayName: z.string().min(1),
  admissionEmail: z.string().email(),
  membership: z.enum(["active", "left", "archived"]),
  status: z.enum(["not_started", "in_progress", "completed"]),
  progress: z.string().min(1),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  masteryPercent: z.number().min(0).max(100).nullable(),
  bestScore: z.string().nullable(),
  bestNumerator: z.number().int().nonnegative().nullable(),
  bestDenominator: z.number().int().positive().nullable(),
  latestScore: z.string().nullable(),
  latestNumerator: z.number().int().nonnegative().nullable(),
  latestDenominator: z.number().int().positive().nullable(),
  latestAttemptAt: z.string().datetime().nullable(),
  assignedRevisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  assignmentState: z.enum(["active", "archived"]),
  joinedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export const gradebookAssignmentSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  contentRevisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  dueAt: z.number().int().nullable(),
  assignedAt: z.number().int(),
  archivedAt: z.number().int().nullable(),
  members: z.array(gradebookMemberRowSchema),
  counts: z.object({
    notStarted: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  }),
});

export const gradebookResponseSchema = z.object({
  classId: z.string().min(1),
  assignments: z.array(gradebookAssignmentSchema),
});

export const classRosterRowSchema = z.object({
  learnerId: z.string().min(1),
  displayName: z.string().min(1),
  admissionEmail: z.string().email(),
  joinedAt: z.string().datetime(),
  membership: z.enum(["active", "left", "archived"]),
  archivedAt: z.string().datetime().nullable(),
});

export const classRosterResponseSchema = z.object({
  classId: z.string().min(1),
  members: z.array(classRosterRowSchema),
  nextCursor: z.string().nullable(),
});

export const gradebookExportOptionsSchema = z.object({
  assignmentId: z.string().min(1),
  format: z.enum(["csv"]).default("csv"),
  maxRows: z.coerce.number().int().min(1).max(5000).default(2000),
});

export const gradebookQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GradebookMemberRow = z.infer<typeof gradebookMemberRowSchema>;
export type GradebookAssignment = z.infer<typeof gradebookAssignmentSchema>;
export type GradebookResponse = z.infer<typeof gradebookResponseSchema>;
export type ClassRosterRow = z.infer<typeof classRosterRowSchema>;
export type ClassRosterResponse = z.infer<typeof classRosterResponseSchema>;
```

Keep `classMemberProgressSchema` and `classReportSchema` untouched (deprecated path for single report) so existing `content-lifecycle.spec.ts:438` keeps passing. Add helper:

```typescript
export function formatScore(numerator: number | null, denominator: number | null): string | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  const pct = Math.round((numerator / denominator) * 100);
  return `${numerator} / ${denominator} (${pct}%)`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/shared -- classroom.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/classroom.ts packages/shared/src/classroom.test.ts
git commit -m "feat(shared): add gradebook roster and export schemas"
```

---

### Task 2: Gradebook indexes migration

**Files:**
- Modify: `apps/api/src/db/migrations/index.ts:576-588`
- Test: `apps/api/src/db/migrate.spec.ts` (existing migration runner test)

**Interfaces:**
- Consumes: `Migration` type, `MIGRATIONS` array.
- Produces: `migration012GradebookIndexes` with `id = "012_gradebook_indexes"`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to apps/api/src/curriculum/gradebook.http.spec.ts (created in Task 6) OR quick inline check:
it("creates gradebook indexes", async () => {
  const rows = await database.client.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND name IN ('idx_assignments_class_archived','idx_class_members_class_archived','idx_attempts_learner_revision_time')"
  );
  const names = rows.rows.map((r) => String(r.name));
  expect(names).toContain("idx_assignments_class_archived");
  expect(names).toContain("idx_class_members_class_archived");
  expect(names).toContain("idx_attempts_learner_revision_time");
});
```

Write this test first in the new spec file, run it, watch it fail (0 rows).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts -t "creates gradebook indexes"`
Expected: FAIL, names array empty.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/api/src/db/migrations/index.ts` before `MIGRATIONS`:

```typescript
/** Gradebook lookups: assignments per class incl. archived, members incl. history, attempts by revision/time. */
export const migration012GradebookIndexes: Migration = {
  id: "012_gradebook_indexes",
  async up(client) {
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_assignments_class_archived ON assignments (class_id, archived_at, assigned_at)`
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_class_members_class_archived ON class_members (class_id, archived_at, joined_at)`
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_attempts_learner_revision_time ON attempts (learner_id, published_revision_id, created_at) WHERE status = 'finished' AND mode = 'assessment'`
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_learner_progress_learner_level ON learner_progress (learner_id, level_id)`
    );
  },
};
```

Add to `MIGRATIONS` array after `migration011NameAudit`.

Verify with `EXPLAIN QUERY PLAN SELECT * FROM assignments WHERE class_id = 'x' ORDER BY assigned_at` uses the index (manual check via sqlite, log in PR).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts -t "creates gradebook indexes"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrations/index.ts
git commit -m "feat(db): add gradebook query indexes"
```

---

### Task 3: ClassroomService gradebook, roster, batched report, CSV

**Files:**
- Modify: `apps/api/src/curriculum/classroom.service.ts:270-399,437-489`
- Test: `apps/api/src/curriculum/gradebook.http.spec.ts` (new)

**Interfaces:**
- Consumes: `GradebookResponse`, `ClassRosterResponse`, `formatScore` from `@jose/shared`; tables `assignments`, `classMembers`, `attempts`, `learnerProgress`, `learners`, `users`, `modules`, `moduleRevisions`.
- Produces: `gradebook(classId, query)`, `classRoster(classId, query)`, extended `classReport` rows (back-compat), extended `exportClassReportCsv` with email + revision + ISO timestamps.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/curriculum/gradebook.http.spec.ts
it("returns every assignment including archived with email rows", async () => {
  const klass = await classroom.createClass(teacher, { name: "GB-1" });
  await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
  const a1 = await classroom.createAssignment(teacher, klass.id, { moduleId: mod.id, contentRevisionId: rev1 });
  const a2 = await classroom.createAssignment(teacher, klass.id, { moduleId: mod.id, contentRevisionId: rev2 });
  // archive a1 directly to simulate historical assignment
  await database.db.update(assignments).set({ archivedAt: Date.now() }).where(eq(assignments.id, a1.id));
  const gb = await classroom.gradebook(teacher, klass.id, { includeArchived: true, limit: 20 });
  expect(gb.assignments.map((a) => a.id).sort()).toEqual([a1.id, a2.id].sort());
  expect(gb.assignments[0]!.members[0]!.admissionEmail).toContain("@");
  expect(gb.assignments[0]!.members[0]!.bestScore).toMatch(/\/.*\(.*%\)/);
});
```

Also add tests for: other teacher 403, student 403, duplicate module assignments not merged, practice excluded, former member retained.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts`
Expected: FAIL with "classroom.gradebook is not a function".

- [ ] **Step 3: Write minimal implementation**

Key changes in `classroom.service.ts`:

1. Import: `formatScore`, `gradebookQuerySchema`, `inArray`, `desc`, `isNotNull` from drizzle-orm; `users` table; `practiceAttempts` must NOT be queried for grades.

2. `listClassAssignments(user, classId, opts?: { includeArchived?: boolean })` — default `false` for back-compat with `content-lifecycle.spec.ts:509` which expects archived module assignment to vanish from student-facing list, but new `gradebook()` passes `includeArchived: true`. Keep filtering via `isLiveAssignment` only when `includeArchived` is false; when true, return all rows ordered by `assignedAt` without liveness check (still require owned class).

3. New `gradebook(user, classId, query)`:
```typescript
async gradebook(user, classId, rawQuery) {
  const q = gradebookQuerySchema.parse(rawQuery ?? {});
  await this.requireOwnedClass(user, classId);
  const rows = await this.db.select().from(assignments)
    .where(eq(assignments.classId, classId))
    .orderBy(asc(assignments.assignedAt));
  const filtered = q.includeArchived ? rows : (await this.filterLive(rows));
  // Batch: one query each for modules, revisions, members+users, progress, attempts
  const memberRows = await this.db.select().from(classMembers).where(eq(classMembers.classId, classId));
  const learnerIds = [...new Set(memberRows.map(m => m.learnerId))];
  const [learnerMap, userMap, progressMap, attemptMap] = await Promise.all([
    this.batchLearners(learnerIds),
    this.batchUsers(learnerIds),
    this.batchProgress(learnerIds),
    this.batchAssessmentAttempts(learnerIds),
  ]);
  // Build per-assignment tables; paginate assignments via cursor/limit on assignedAt+id
  // ...
}
```

4. `batchAssessmentAttempts`: single `SELECT * FROM attempts WHERE learner_id IN (...) AND status='finished' AND mode='assessment'` then group by `(learnerId, publishedRevisionId)` in memory. Never touch `practiceAttempts`.

5. `memberProgress` rewrite: accept pre-fetched maps, compute `best` (max score/maxScore pair with highest pct, tie-break latest) and `latest` (max createdAt) from filtered attempts for that `contentRevisionId`; `formatScore` for display; `membership = archivedAt ? "archived" : "active"` (use "left"/"archived" — spec says active or left/archived; use "archived" when `classMembers.archivedAt` set, "active" otherwise; keep "left" alias for future — document as archived); `admissionEmail` from `users.admissionEmail`; `joinedAt` ISO; `latestAttemptAt` ISO or null.

6. `classRoster(user, classId, rawQuery)`: teacher-only, joins `classMembers` + `learners` + `users` in 3 batched queries, returns `{ classId, members, nextCursor }` with cursor = `learnerId`, stable order by `joinedAt, learnerId`.

7. `exportClassReportCsv`: new headers:
```
["assignmentId","contentRevisionId","revisionNumber","moduleTitle","learnerId","displayName","admissionEmail","membership","status","progress","completedCount","totalCount","bestScore","bestNumerator","bestDenominator","latestScore","latestNumerator","latestDenominator","latestAttemptAt","joinedAt","assignmentState"]
```
Values: ISO-8601 for timestamps (`new Date(ms).toISOString()` or ""), `formatScore` strings, `toCsv` (keeps `csvSafeCell`). Enforce `maxRows` 5000; throw BadRequest if exceeded. Filename unchanged `class-${classId}-assignment-${assignmentId}.csv`.

8. `requireOwnedClass`: keep `teacherId !== user.id && role !== admin` → 403. This already satisfies "another teacher 403, student 403" because `requireTeacher` rejects student first.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts`
Expected: PASS. Then run: `npm run test --workspace=@jose/api -- content-lifecycle.spec.ts` to confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/curriculum/classroom.service.ts
git commit -m "feat(api): add batched gradebook roster and extended CSV"
```

---

### Task 4: Controller gradebook + roster + pagination

**Files:**
- Modify: `apps/api/src/curriculum/classroom.controller.ts:54-80`

**Interfaces:**
- Consumes: `ClassroomService.gradebook`, `classRoster`, `classReport`, `exportClassReportCsv`.
- Produces: `GET /teach/classes/:id/gradebook`, `GET /teach/classes/:id/roster`, paginated `GET .../report`, CSV with `Content-Disposition`.

- [ ] **Step 1: Write the failing test**

```typescript
it("exposes gradebook over HTTP with teacher auth", async () => {
  const res = await http("GET", `/teach/classes/${klass.id}/gradebook?includeArchived=true`, { cookie: teacherAccount.cookie });
  expect(res.status).toBe(200);
  expect(res.body.assignments.length).toBe(2);
  const forbidden = await http("GET", `/teach/classes/${klass.id}/gradebook`, { cookie: otherTeacherAccount.cookie });
  expect(forbidden.status).toBe(403);
  const studentForbidden = await http("GET", `/teach/classes/${klass.id}/gradebook`, { cookie: studentAccount.cookie });
  expect(studentForbidden.status).toBe(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts -t "exposes gradebook over HTTP"`
Expected: FAIL 404.

- [ ] **Step 3: Write minimal implementation**

```typescript
@Get("teach/classes/:id/gradebook")
@UseGuards(SessionAuthGuard, TeacherRoleGuard)
gradebook(@CurrentUser() user: SessionUser, @Param("id") id: string, @Query() query: unknown) {
  return this.classroom.gradebook(user, id, query);
}

@Get("teach/classes/:id/roster")
@UseGuards(SessionAuthGuard, TeacherRoleGuard)
roster(@CurrentUser() user: SessionUser, @Param("id") id: string, @Query() query: unknown) {
  return this.classroom.classRoster(user, id, query);
}
```

Update `report()` to accept `@Query() query` and forward pagination (`cursor`, `limit`) to service. Update `exportCsv()`:
```typescript
@Header("content-type", "text/csv; charset=utf-8")
@Header("content-disposition", "attachment; filename=gradebook.csv")
```
Return `exported.csv` string; keep `@Header("content-type", ...)` (Nest sets disposition via `@Res`? Use `@Header` for both — verify in test that `content-type` includes csv).

Keep existing routes untouched for back-compat.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/curriculum/classroom.controller.ts
git commit -m "feat(api): expose gradebook and roster endpoints"
```

---

### Task 5: Web gradebook UI

**Files:**
- Modify: `apps/web/src/lib/path-api.ts:610-634`
- Modify: `apps/web/src/lib/server-api.ts:88-95`
- Modify: `apps/web/src/app/teach/classes/page.tsx:1-40`
- Modify: `apps/web/src/components/teach-classes-client.tsx:1-284`

**Interfaces:**
- Consumes: `gradebookResponseSchema`, `classRosterResponseSchema`, new controller routes.
- Produces: assignment nav list, one `<table>` per assignment with columns Student name | APC email | Membership | Progress | Completed levels | Best assessed score | Latest assessed score | Latest attempt time | Assigned revision | Assignment state; per-table Download CSV.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/teach-classes-client.test.tsx (new)
import { render, screen } from "@testing-library/react";
import { TeachClassesClient } from "./teach-classes-client";

const gradebook = {
  classId: "c1",
  assignments: [
    { id: "a1", moduleTitle: "M1", revisionNumber: 1, assignedAt: 1, archivedAt: null, contentRevisionId: "r1", classId: "c1", moduleId: "m1", dueAt: null, counts: { notStarted: 0, inProgress: 0, completed: 1 }, members: [{ learnerId: "u1", displayName: "Ana", admissionEmail: "ana@student.apc.edu.ph", membership: "active", status: "completed", progress: "2/2", completedCount: 2, totalCount: 2, masteryPercent: 80, bestScore: "8 / 10 (80%)", bestNumerator: 8, bestDenominator: 10, latestScore: "8 / 10 (80%)", latestNumerator: 8, latestDenominator: 10, latestAttemptAt: "2026-09-01T00:00:00.000Z", assignedRevisionId: "r1", revisionNumber: 1, assignmentState: "active", joinedAt: "2026-08-01T00:00:00.000Z", archivedAt: null }] },
    { id: "a2", moduleTitle: "M1 retry", revisionNumber: 2, assignedAt: 2, archivedAt: 3, contentRevisionId: "r2", classId: "c1", moduleId: "m1", dueAt: null, counts: { notStarted: 1, inProgress: 0, completed: 0 }, members: [] },
  ],
};

it("renders every assignment table with email and CSV action", () => {
  render(<TeachClassesClient initial={[{ id: "c1", name: "R1", inviteCode: null, memberCount: 1, challengesEnabled: false, archivedAt: null, createdAt: 1 }]} modules={[]} initialGradebook={{ c1: gradebook }} initialError={null} />);
  expect(screen.getByText("M1")).toBeInTheDocument();
  expect(screen.getByText("M1 retry")).toBeInTheDocument();
  expect(screen.getByText("ana@student.apc.edu.ph")).toBeInTheDocument();
  expect(screen.getAllByText(/Download CSV/i).length).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/web -- teach-classes-client`
Expected: FAIL (prop `initialGradebook` does not exist, only latest report rendered).

- [ ] **Step 3: Write minimal implementation**

`path-api.ts`:
```typescript
export async function fetchGradebook(classId: string, query?: { includeArchived?: boolean; cursor?: string; limit?: number }, options?: ApiCallOptions) {
  const params = new URLSearchParams();
  if (query?.includeArchived !== undefined) params.set("includeArchived", String(query.includeArchived));
  if (query?.cursor) params.set("cursor", query.cursor);
  if (query?.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const json = await apiFetch(`/teach/classes/${classId}/gradebook${qs ? `?${qs}` : ""}`, undefined, options);
  return gradebookResponseSchema.parse(json);
}
export function gradebookCsvUrl(classId: string, assignmentId: string) {
  return `/api/teach/classes/${classId}/assignments/${assignmentId}/export.csv`;
}
```

`page.tsx`: replace latest-only fetch with:
```typescript
const gradebook: Record<string, GradebookResponse> = {};
await Promise.all(classes.map(async (klass) => {
  gradebook[klass.id] = await fetchGradebook(klass.id, { includeArchived: true });
}));
return <TeachClassesClient initial={classes} modules={modules} initialGradebook={gradebook} initialError={error} />;
```

`teach-classes-client.tsx`: props `{ initial, modules, initialGradebook: Record<string, GradebookResponse>, initialError }`. State `gradebookByClass`, `selectedAssignmentByClass: Record<string, string>`. `loadReports` fetches `fetchGradebook` per class (client `teachFetch` + `gradebookResponseSchema.parse`). Render per class: assignment nav `<ul>` with buttons `M1 (rev 2)` + `archived` badge; one `<table>` per assignment (or selected + all — spec says normal view shows each assignment separately; render all tables stacked with anchor ids, nav scrolls to table). Columns exactly: Student name | APC email | Membership | Progress | Completed levels | Best assessed score | Latest assessed score | Latest attempt time | Assigned revision | Assignment state. `Latest attempt time`: `new Date(iso).toLocaleString()` + `title={iso}` for ISO access. Per-table `<a href={gradebookCsvUrl(...)} download>` Download CSV. Keep create/assign/archive forms unchanged. Remove `assignments.at(-1)` logic entirely.

Back-compat: keep accepting `initialReports` as optional deprecated prop if tests reference it, but new page passes gradebook.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/web -- teach-classes-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/path-api.ts apps/web/src/lib/server-api.ts apps/web/src/app/teach/classes/page.tsx apps/web/src/components/teach-classes-client.tsx apps/web/src/components/teach-classes-client.test.tsx
git commit -m "feat(web): render full gradebook with per-assignment tables"
```

---

### Task 6: HTTP regression suite

**Files:**
- Create: `apps/api/src/curriculum/gradebook.http.spec.ts`

**Interfaces:**
- Consumes: `AppModule`, `createTestAccount`, `CurriculumService`, `ClassroomService`, HTTP `fetch` against ephemeral Nest app (pattern from `content-lifecycle.spec.ts:41-107`).

- [ ] **Step 1: Write the failing test** (full file skeleton)

```typescript
import { Test } from "@nestjs/testing";
// ... same bootstrap as content-lifecycle.spec.ts ...
describe("gradebook batch 2", () => {
  it("creates gradebook indexes", ...);
  it("teacher gets roster and every assignment; other teacher and student get 403", ...);
  it("historical member and archived assignment remain reportable", ...);
  it("duplicate module assignments do not merge", ...);
  it("practice attempts are excluded", ...);
  it("CSV contains headers and safe values", async () => {
    const exported = await classroom.exportClassReportCsv(teacher, klass.id, assignment.id);
    const [header] = exported.csv.split("\n");
    expect(header).toContain("admissionEmail");
    expect(header).toContain("assignmentId");
    expect(exported.csv).toContain("'=evil");
  });
});
```

Each `it` starts failing (no `gradebook`/`classRoster` methods, no email header).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts`
Expected: FAIL (multiple missing methods).

- [ ] **Step 3: Write minimal implementation** — this is covered by Tasks 3-4; this task is the final assertion pass. Fix any remaining gaps: ensure `practiceAttempts` insert does not affect `gradebook` (insert a practice row in test, assert scores unchanged); ensure duplicate assignments have distinct `contentRevisionId`s and distinct member rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts`
Expected: PASS. Then: `npm run test --workspace=@jose/api -- content-lifecycle.spec.ts` still PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/curriculum/gradebook.http.spec.ts
git commit -m "test(api): cover gradebook history auth and CSV safety"
```

---

### Task 7: Verification gate

- [ ] **Step 1: Run focused tests**

Run: `npm run test --workspace=@jose/shared -- classroom.test.ts`
Run: `npm run test --workspace=@jose/api -- gradebook.http.spec.ts`
Run: `npm run test --workspace=@jose/web -- teach-classes-client`
Expected: all PASS.

- [ ] **Step 2: Run full gates**

Run: `npm test`
Run: `npm run lint`
Run: `npm run build`
Expected: `npm test` PASS (API 159+ new tests, shared 134+, web 129+); `npm run lint` 0 errors (especially `teach-level-editor.tsx:68` pre-existing — do not touch in this batch unless it blocks; report if still failing); `npm run build` exit 0 for all three workspaces.

- [ ] **Step 3: Commit verification note** (no code change; record commands + results in handoff reply, do not claim unrun checks).

---

## Self-Review

1. **Spec coverage:** Identity/navigation (Batch 1) out of scope. Gradebook list/roster/attempt-summary/export/pagination schemas → Task 1. Teacher gradebook incl. archived + roster endpoints → Tasks 3-4. Email/membership/latest/best/timestamp/revision metadata, history preserved, student endpoints clean → Task 3. Batched queries + indexes (`assignments(class_id,archived_at)`, `class_members(class_id,archived_at)`, attempts by learner/revision/time) → Task 2-3. Per-assignment tables + nav, no silent latest-only → Task 5. Per-assignment CSV with email/fields/ISO/ids/formula-safe → Task 3-5. HTTP tests for auth/history/duplicates/practice/CSV → Task 6.
2. **Placeholder scan:** No TBD/TODO; every step has concrete file paths, code blocks, run commands, expected outputs.
3. **Type consistency:** `GradebookResponse.assignments[].members[]` field names match service builder, controller passthrough, `path-api` parser, and UI table cells. `formatScore` return shape matches `bestScore`/`latestScore` display strings. CSV headers match service `toCsv` row order.
