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
npm run db:seed -- --demo
npm run dev
```

- Web: http://localhost:3000/learn  
- API: http://localhost:3001/health  
- Teacher studio: Profile → Teacher studio, or http://localhost:3000/teach  

The API opens `apps/api/data/jose.sqlite` (or `JOSE_DATABASE_URL`) and ensures the schema on boot. **It does not seed content on startup.**

### Seeding (explicit, versioned)

```bash
# Curriculum only (Rizal path + Ateneo days). Safe to re-run; history is recorded.
npm run db:seed

# Opt in to the shared demo learner (prefab XP / streak / progress) for local play.
npm run db:seed -- --demo
```

Seed application is tracked in `seed_history`. Re-running or restarting the API will not restore editorial deletions or invent learner achievements. Production accounts should be created with honest defaults (`createHonestLearner`: 0 XP, 0 streak, no progress).

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
