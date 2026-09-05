# Jose

Kids-first adventure path for the Filipino college course **Work and Life of Rizal**.
Module grid + Duolingo-style levels (Next.js) and NestJS API with local SQLite (Turso-ready).

## Stack

- Turborepo monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Next.js 16 + Tailwind CSS v4
- NestJS REST + Drizzle + libSQL (`apps/api/data/jose.sqlite`)
- Zod shared schemas

## Quick start

```bash
npm install
npm run build --workspace=@jose/shared
npm run dev
```

- Web: http://localhost:3000/learn  
- API: http://localhost:3001/health  
- Teacher studio: Profile → Teacher studio, or http://localhost:3000/teach  

The API creates `apps/api/data/jose.sqlite` and seeds **Work and Life of Rizal** plus the **Ateneo days** deep dive on first boot.

## Tests

```bash
npm test
```

## Accounts & sessions

Learner progress is keyed by the verified server session (`jose_session` HttpOnly cookie), never by a client-supplied learner id.

- **Demo mode** (`JOSE_DEMO_MODE=true`): anonymous traffic uses the isolated `demo-student` row.
- **Dev login** (`JOSE_DEV_LOGIN=true`): Profile → sign in with a stable account key to create a separate learner.
- **Microsoft Entra**: disabled until `JOSE_MS_CLIENT_ID`, `JOSE_MS_CLIENT_SECRET`, and `JOSE_MS_REDIRECT_URI` are all set (see `apps/api/.env.example`).

Browser calls go through the Next.js `/api` rewrite so the session cookie stays same-origin.

- Modules / lessons / games: `docs/superpowers/specs/2026-08-15-rizal-modules-lessons-games-design.md`
- Game stage (playable boards): `docs/superpowers/specs/2026-08-23-game-stage-design.md`
- Future work (accounts, Turso, monitoring): `docs/superpowers/specs/2026-08-15-jose-future-work.md`
- Original path: `docs/superpowers/specs/2026-08-07-rizal-levels-path-design.md`
- Profile: `docs/superpowers/specs/2026-08-11-fun-profile-page-design.md`
