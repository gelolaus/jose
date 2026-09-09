# Jose production deployment (Vercel web + self-hosted API)

Copy `.env.production.example` values into host secrets. Never use `NEXT_PUBLIC_*`
for the Turso token, OAuth secret, or session secret.

## 1. Turso database

```bash
# Preferred clean start: create a NEW empty database, do not clear a live one.
turso db create jose-prod
turso db show jose-prod --url            # -> libsql://...
turso db tokens create jose-prod         # -> JOSE_DATABASE_AUTH_TOKEN
```

Existing data: take a preflight logical backup before any cutover:

```bash
JOSE_DATABASE_URL=libsql://... JOSE_DATABASE_AUTH_TOKEN=... \
  npm run db:backup -- --json --out=./data/backups/pre-deploy.json
```

## 2. API secrets

Set on the API host only:

- `JOSE_DATABASE_URL=libsql://your-db.turso.io`
- `JOSE_DATABASE_AUTH_TOKEN=...`
- `JOSE_WEB_ORIGIN=https://jose.your-school.edu`
- `JOSE_ALLOWED_ORIGINS=https://jose.your-school.edu` (exact HTTPS, no localhost)
- `JOSE_API_PUBLIC_URL=https://api.your-school.edu`
- `JOSE_AUTH_MODE=microsoft` plus `JOSE_MICROSOFT_CLIENT_ID`,
  `JOSE_MICROSOFT_CLIENT_SECRET`, `JOSE_MICROSOFT_TENANT=common`,
  `JOSE_MICROSOFT_REDIRECT_URI=https://jose.your-school.edu/api/auth/microsoft/callback`
- `JOSE_SESSION_SECRET` (32+ random chars), `JOSE_COOKIE_SECURE=true`
- `JOSE_TRUST_PROXY=1` when behind one reverse proxy (hop count, not `true`);
  leave unset/false with no proxy. Rate limits use `req.ip` only.

Production refuses to boot with `JOSE_AUTH_MODE=mock|disabled` or
`JOSE_DEMO_MODE=true`.

## 3. Migrate, then start API

```bash
JOSE_DATABASE_URL=libsql://... JOSE_DATABASE_AUTH_TOKEN=... npm run db:migrate
# expect: skipped/applied list ending with 013_empty_start
npm run start --workspace=@jose/api
curl -s https://api.your-school.edu/ready   # -> {"ok":true,"database":"up"}
```

`DatabaseService` asserts migrations in production; it never seeds or empties.

## 4. Web (Vercel)

- No Vercel environment variable is required for Jose's stable API domain:
  `https://api.jose.gelolaus.com` is the production rewrite fallback.
- On another host, set server-only `JOSE_INTERNAL_API_URL=https://api.your-school.edu`.
- Leave `NEXT_PUBLIC_API_URL` unset so the browser uses same-origin `/api`
  (Next rewrite in `apps/web/next.config.ts` keeps the session cookie first-party).
- Deploy web, then verify `https://jose.your-school.edu/api/health` proxies.

## 5. Deployment order checklist

1. Create/backup Turso database.
2. Set API secrets.
3. Run `npm run db:migrate` against Turso.
4. Deploy API and verify `/ready`.
5. Set Vercel server-only rewrite target and deploy web.
6. Verify login with an APC Microsoft account, a teacher-only request
   (student gets 403 `TEACHER_DENIED`), one per-assignment CSV export,
   and logout (session revoked, `/teach/*` → 401).
7. Delete one-time bootstrap/promotion tokens from the environment.

See `docs/ops/staging-smoke-and-rollback.md` and
`docs/ops/empty-start-and-cutover.md`.
