# Jose

Kids-first adventure path for the Filipino college course **Work and Life of Rizal**.
Duolingo-style levels UI (Next.js) + seeded demo API (NestJS).

## Stack

- Turborepo monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Next.js 16 + Tailwind CSS v4
- NestJS REST (`GET /path/demo`, `GET /health`)
- Zod shared schemas

## Quick start

```bash
npm install
npm run build --workspace=@jose/shared
npm run dev
```

- Web: http://localhost:3000/learn  
- API: http://localhost:3001/path/demo  

Or run separately:

```bash
npm run dev:api
npm run dev:web
```

## Tests

```bash
npm test
```

## Docs

- Design: `docs/superpowers/specs/2026-08-07-rizal-levels-path-design.md`
- Plan: `docs/superpowers/plans/2026-08-07-rizal-levels-path.md`
