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
- Teacher studio: Profile → Teacher studio (teachers/admins only), or http://localhost:3000/teach  

Teacher and admin access are enforced on the API. Bootstrap the first admin once with `JOSE_SESSION_SECRET`, `JOSE_ADMIN_BOOTSTRAP_EMAIL`, and `JOSE_ADMIN_BOOTSTRAP_TOKEN`, then `POST /auth/admin/bootstrap`. Promote teachers with `POST /admin/accounts/role` (admin session required). An `@apc.edu.ph` address never grants teacher access by itself.

The API creates `apps/api/data/jose.sqlite` and seeds **Work and Life of Rizal** plus the **Ateneo days** deep dive on first boot.

## Tests

```bash
npm test
```

## Docs

- Modules / lessons / games: `docs/superpowers/specs/2026-08-15-rizal-modules-lessons-games-design.md`
- Game stage (playable boards): `docs/superpowers/specs/2026-08-23-game-stage-design.md`
- Future work (accounts, Turso, monitoring): `docs/superpowers/specs/2026-08-15-jose-future-work.md`
- Original path: `docs/superpowers/specs/2026-08-07-rizal-levels-path-design.md`
- Profile: `docs/superpowers/specs/2026-08-11-fun-profile-page-design.md`
