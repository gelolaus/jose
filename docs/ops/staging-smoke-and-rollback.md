# Staging smoke checks and rollback

## Pre-deploy

1. Set production/staging secrets in the host (never in `NEXT_PUBLIC_*`):
   - `JOSE_DATABASE_URL` — persistent volume `file:` path **or** hosted `libsql://…`
   - `JOSE_DATABASE_AUTH_TOKEN` — required for hosted libSQL
   - `JOSE_WEB_ORIGIN` / `JOSE_ALLOWED_ORIGINS` — HTTPS web origin(s)
   - `JOSE_AUTH_MODE=microsoft` with Entra credentials (mock/demo/stub are refused)
2. Take a backup: `npm run db:backup -- --json --out=./data/backups/pre-deploy.json`
3. Apply migrations as a controlled step: `npm run db:migrate`
4. Start API, then web. Browser calls same-origin `/api` (Next rewrite → `JOSE_INTERNAL_API_URL`).

If the process sits behind a reverse proxy, set `JOSE_TRUST_PROXY` to the hop count
(for example `1`). Rate limits use Express `req.ip`; they do not read `X-Forwarded-For`
directly, so leaving trust-proxy off ignores spoofed client IPs.

## Smoke checklist

- `GET /health` → `{ ok: true }`
- `GET /ready` → `{ ok: true, database: "up" }` (fail deploy if 503)
- Anonymous `GET /teach/modules` → `401`
- Signed-in student → `403` on `/teach/*` (`TEACHER_DENIED`)
- Student can load `/modules` over HTTPS via the web origin
- Oversized attempt payload returns `400`
- Confirm logs show `requestId` / `supportRef` and no raw emails, answers, or tokens

## Rollback

1. Stop the new API revision.
2. Restore DB: `JOSE_DATABASE_URL=… npm run db:restore -- --from=./data/backups/pre-deploy.json`
   - For file-copy backups: stop API, replace the sqlite file on the volume, run `db:migrate`, start API.
3. Redeploy the previous container/image.
4. Re-run `/ready` and one teach/student smoke path.

## Recovery targets (confirm with owner before production)

Document RPO/RTO with the project owner. Suggested starting point for discussion: RPO ≤ 24h (daily backup), RTO ≤ 1h (restore + migrate + smoke). Adjust after the first staging restore drill.

## Ephemeral disks

Do **not** point `JOSE_DATABASE_URL` at container-ephemeral storage. Use a mounted volume or Turso. Restarts must not erase learner attempts.
