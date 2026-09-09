# Jose

Historical investigation adventure for the Filipino college course **Work and Life of Rizal** (APC RIZLIFE), also approachable for younger learners.

Module grid + adventure path (Next.js) and NestJS API with local SQLite (Turso-ready). Presentation modes: **Adventure** and **Focus**.

## Stack

- Turborepo monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Next.js 16 + Tailwind CSS v4
- NestJS REST + Drizzle + libSQL (`apps/api/data/jose.sqlite`)
- Zod shared schemas

## Quick start

```bash
npm install
npm run build --workspace=@jose/shared
export JOSE_AUTH_MODE=mock JOSE_DEMO_MODE=true \
  JOSE_SESSION_SECRET=dev-only-change-me-to-a-long-random-secret \
  JOSE_WEB_ORIGIN=http://localhost:3000 JOSE_API_PUBLIC_URL=http://localhost:3001
npm run dev
```

The API reads its configuration from the environment (there is no `.env` loader), so export the
variables above — see `apps/api/.env.example` for the full list. `JOSE_DEMO_MODE=true` lets you
browse as the shared demo learner before signing in; without it the learning routes ask for a
sign-in, and without `JOSE_AUTH_MODE` there is no way to sign in at all.

- Web: http://localhost:3000/learn  
- Sign-in (mock or Microsoft): http://localhost:3000/login  
- API: http://localhost:3001/health  
- Readiness: http://localhost:3001/ready  
- Teacher studio: Profile → Teacher studio, or http://localhost:3000/teach  

The API creates `apps/api/data/jose.sqlite` on first boot but does **not** insert curriculum or demo progress automatically. After a fresh database (or deploy), seed explicitly:

```bash
npm run db:seed                 # curriculum@1 only — honest empty learner stats
npm run db:seed -- --demo       # also apply demo-learner@1 (local shared Explorer only)
```

Re-running the seed command skips already-applied versions, so deleting a seeded extra or the Ateneo module survives restart. `JOSE_DEMO_MODE` never invents XP for a signed-in student; production refuses to boot with it enabled.

Versioned schema changes live in `apps/api/src/db/migrations`. Development applies them on API boot; production must run `npm run db:migrate` first. Backup and restore:

```bash
npm run db:migrate
npm run db:backup -- --json --out=./apps/api/data/backups/pre-change.json
# npm run db:restore -- --from=./apps/api/data/backups/pre-change.json
```

Point `JOSE_DATABASE_URL` at a persistent volume or hosted libSQL — never an ephemeral container disk. See `docs/ops/staging-smoke-and-rollback.md`.

## Accounts and sign-in

In production, sign-in is Microsoft (Entra ID) only, and only for exactly `@apc.edu.ph` and
`@student.apc.edu.ph` mailboxes. Any other domain is denied, including look-alikes such as `apc.edu.ph.example.com`.
A signed-in student gets their own learner row, so XP, hearts, streak and level progress never
leak between accounts. Sessions live in an HttpOnly `jose_session` cookie; the API never reads
identity from a request header. Display names are copied from the admitted account at creation
and are immutable via self-service profile editing (avatar-only); name corrections require an
admin support action via `POST /admin/users/name-correction` with an audit row.

`JOSE_AUTH_MODE` picks the stack:

| Mode | Use |
| --- | --- |
| `disabled` (default) | No sign-in. Local browsing only. |
| `mock` | Local and CI. Pick an identity without calling Microsoft. Rejected in production. |
| `microsoft` | Real Entra ID sign-in. The only mode allowed in production. |

### Roles and module ownership

Every user is `student`, `teacher` or `admin`; an APC staff mailbox alone does not grant teaching
rights. Teacher studio routes require a real signed-in `teacher` or `admin`.

- A teacher edits the modules they own (`modules.owner_user_id`).
- Another teacher's module is 403 unless they were added as a collaborator
  (`POST /teach/modules/:moduleId/collaborators`, owner or admin only).
- Seeded curriculum has no owner, so only admins can edit it.

### First admin

There are no seeded admin accounts. Bootstrap one once, on the running deployment:

```bash
JOSE_ADMIN_BOOTSTRAP_EMAIL=you@apc.edu.ph JOSE_ADMIN_BOOTSTRAP_TOKEN=<long-random> npm run dev
curl -X POST http://localhost:3001/auth/admin/bootstrap \
  -H 'content-type: application/json' \
  -d '{"token":"<long-random>","displayName":"Your Name"}'
```

It succeeds only while no admin exists, and sets a session cookie rather than returning a token.
Remove both variables afterwards. That admin then promotes teachers with
`POST /admin/users/role` (`student` or `teacher` only — admin is never granted over HTTP).

Pinned promotion for `arlaus@student.apc.edu.ph` (must already exist from normal sign-in,
idempotent, writes `role_audit`; delete the token afterwards):

```bash
JOSE_PROMOTE_ARLAUS_TOKEN=<long-random> npm run db:promote-arlaus --workspace=@jose/api
```

### Before deploying to production

The API refuses to boot in production (`NODE_ENV=production` or `JOSE_ENV=production`) when any
test-only login path is still enabled, so remove these:

- `JOSE_AUTH_MODE=mock`
- `JOSE_DEMO_MODE=true`
- `JOSE_AUTH_MODE=disabled`
- `JOSE_MAIL_TRANSPORT=memory` while `JOSE_AUTH_MODE=microsoft`

Local dev login shortcuts (`/auth/dev/*`, `LocalDevPanel`, local role switch) were deleted
and must not be reintroduced.

Full setup steps, including the Entra app registration, are in
`docs/auth/microsoft-entra-setup.md`, and every variable is listed in `apps/api/.env.example`.

## Tests

```bash
npm test
```

## Content ownership

Seed lessons are structural placeholders. See `docs/CONTENT_GAPS.md` for syllabus, objectives, citations, and review work instructors must supply.

## Docs

- Design language (current student UI): `docs/superpowers/specs/2026-09-08-jose-design-language.md`
- Teacher chrome and module maker: `docs/superpowers/specs/2026-09-08-teacher-area-design.md`
- Application review / handoff: `docs/reviews/2026-09-05-application-review.md`
- Microsoft / APC login setup: `docs/auth/microsoft-entra-setup.md`
