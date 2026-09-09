# Empty start and cutover

The empty-start release ships no curriculum. A fresh `db:migrate` is an empty
database; teachers author afterwards via Teacher studio or JMM import.

## Preferred: new empty Turso database

1. `turso db create jose-prod`
2. Set `JOSE_DATABASE_URL=libsql://...` + `JOSE_DATABASE_AUTH_TOKEN=...`.
3. `npm run db:migrate` (ends with `013_empty_start`).
4. Verify `/ready`, then follow `docs/ops/deployment.md`.
5. Keep the old database untouched until the cutover is accepted.

Do not code-delete data because a database has no modules. `013_empty_start`
is a non-destructive marker: it backfills `modules.status` where NULL and
never deletes users, learners, attempts, revisions, or history.

## If a cutover must discard data

1. Logical backup first (required):
   `npm run db:backup -- --json --out=./data/backups/pre-cutover.json`
2. Keep a file copy too for `file:` URLs.
3. Record who approved, when, and where the backup lives.
4. Restore drill: `npm run db:restore -- --from=./data/backups/pre-cutover.json`
   into a scratch database, then `/ready` + one teacher/student path.
5. Only then proceed with the new empty database.

## Guarded local `db:empty` (never automatic)

`db:empty` is for disposable local `file:` databases only. It never runs on
startup or deploy, requires an explicit `JOSE_DATABASE_URL`, the exact phrase
`EMPTY-JOSE-DATABASE`, and writes a preflight backup first. It refuses remote
`libsql://` URLs unless `--allow-remote` plus `JOSE_ALLOW_EMPTY_REMOTE=true`
are both present, and refuses production unless
`JOSE_ALLOW_EMPTY_PRODUCTION=true` is set.

```bash
JOSE_DATABASE_URL="file:./apps/api/data/dev.sqlite" \
  npm run db:empty --workspace=@jose/api -- \
  --confirm=EMPTY-JOSE-DATABASE --backup-out=./data/backups/pre-empty.json
```

After emptying, migrations are re-applied so the result is still a valid empty
release (schema preserved, `schema_migrations` intact).

## Migration / rollback

- Migrate: `npm run db:migrate` (safe to re-run; applied rows are skipped).
- Rollback code: redeploy the previous API/web revision, then `/ready`.
- Rollback data: restore the pre-cutover logical backup, run `db:migrate`,
  re-run smoke checks. Never restore a `.sqlite` file over a running API;
  stop the API first.
