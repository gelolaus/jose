# Rizal Levels Path Implementation Plan

> **For agentic workers:** Execute inline in this session (user requested runnable output). Steps use checkbox syntax for tracking.

**Goal:** Ship a Turborepo monorepo with Nest demo path API and Next kids-fun Duolingo-style Rizal levels page.

**Architecture:** `packages/shared` Zod schemas; Nest seeds chronological sections + demo progress at `GET /path/demo`; Next App Router renders learning shell + zig-zag path + placeholder lessons.

**Tech Stack:** Turborepo, npm workspaces, Next.js 16, NestJS, Tailwind CSS v4, Zod, Vitest, Nest Jest

## Global Constraints

- Mobile-first; desktop = centered narrow path column
- Kids-fun bright hybrid (not wantap dark theme); wantap-level craft (fonts, CSS vars, Zod, tests)
- Demo progress only — no auth/DB
- Placeholder lessons only
- Do not commit unless user asks (draft message at end)

## File map

- `package.json`, `turbo.json`, `.gitignore`, `README.md`
- `packages/shared/package.json`, `src/index.ts`, `src/path.ts`, `src/path.test.ts`
- `apps/api/` Nest app: `path` module + seed data + CORS
- `apps/web/` Next app: learn routes, path UI, shell, globals.css

---

### Task 1: Monorepo + shared Zod package

**Files:**
- Create: root workspace config, `packages/shared/**`

- [x] Scaffold workspaces + shared `PathResponse` schema + vitest
- [x] Export types for api/web

### Task 2: Nest API with seeded path

**Files:**
- Create: `apps/api/**`

- [x] `GET /health`, `GET /path/demo` with CORS
- [x] Validate response shape against shared schema in a unit/e2e test

### Task 3: Next web — shell + path UI

**Files:**
- Create: `apps/web/**`

- [x] Learning chrome, zig-zag path, nodes, chest, section colors
- [x] Routes: `/`, `/learn`, `/learn/[nodeId]`, `/practice`, `/profile`
- [x] Locked shake + toast; fetch + Zod parse

### Task 4: Verify runnable

- [x] Install deps, run api + web, smoke-check endpoints and UI build
