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

## Content ownership

Seed lessons are structural placeholders. See `docs/CONTENT_GAPS.md` for syllabus, objectives, citations, and review work instructors must supply.

## Docs

- Application review / handoff: `docs/reviews/2026-09-05-application-review.md`
- Modules / lessons / games: `docs/superpowers/specs/2026-08-15-rizal-modules-lessons-games-design.md`
- Game stage (playable boards): `docs/superpowers/specs/2026-08-23-game-stage-design.md`
- Future work (accounts, Turso, monitoring): `docs/superpowers/specs/2026-08-15-jose-future-work.md`
- Original path: `docs/superpowers/specs/2026-08-07-rizal-levels-path-design.md`
- Profile: `docs/superpowers/specs/2026-08-11-fun-profile-page-design.md`
