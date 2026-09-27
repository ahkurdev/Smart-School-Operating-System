# Project State

> Last updated: Phase 11 complete. Next: Phase 12 (Student data model).

## Current status

| Field | Value |
|---|---|
| Current phase | 17 completed, starting 18 |
| Phases completed | 1-17 |
| Next phase | 18 - Admin shell/navigation |
| Build state | production build green, lint clean, typecheck clean |
| Tests | no automated tests yet (added Phase 95); manual browser E2E done |

## Verification (proof of function)

- `npx tsc --noEmit` -> 0 errors; `npx eslint .` -> 0 problems;
  `npx next build` -> compiles, 13 routes, no warnings.
- Real browser E2E: login as `admin@demo.local` -> dashboard with live counts ->
  permission-filtered sidebar (admin does NOT see Finance/Assets/Settings/Audit,
  proving RBAC) -> `/app/users` renders 20 seeded users with roles + status +
  search + pagination -> **0 console errors**.

## Environment

- Node v26.7.0, npm 11.19.0, git 2.54.0 (Windows, git-bash).
- Local PostgreSQL 16.15 at `.pgsql/` (portable), data dir `.pgdata/`,
  DB `smart_school`, port **5433**, auth `trust`.
- **Known environment issue (resolved):** on this Windows host, launching the
  postmaster via `pg_ctl.exe` makes backend child processes crash with exception
  `0xC0000142`. Fix: launch `postgres.exe` **directly** (see `scripts/pg.sh`).
  Also completed the originally-incomplete `.pgsql/bin` by extracting the full
  PostgreSQL 16.15 Windows binaries.
- Secrets live in `.env` (git-ignored). `.env.example` has placeholders only.

## Architectural decisions (see ARCHITECTURE.md for ADRs)

- ADR-0001 Modular monolith over microservices.
- ADR-0002 Shared-schema multi-tenancy, mandatory `tenantId`, compound indexes.
- ADR-0003 Prisma + PostgreSQL (no vendor lock).
- ADR-0004 Signed rotating QR attendance token, no PII in QR.
- ADR-0005 OpenAI-compatible AI provider abstraction.
- ADR-0006 StorageProvider abstraction (local / S3-compatible).
- ID strategy: `cuid()` (portable, collision-free, roughly sortable).

## Database

- Single migration: `20260927163838_init` (97 tables, 50 enums).
- Schema: `prisma/schema.prisma`.

## Completed phase log

- Phase 1 Repository discovery / environment audit. DONE
- Phase 2 Anti-Slop installed (`anti-slop/`, `.agents/`). DONE
- Phase 3 ARCHITECTURE.md + ADRs. DONE
- Phase 4 Technology bootstrap (Next 15, React 19, Tailwind, TS strict). DONE
- Phase 5 DESIGN.md + design tokens direction. DONE
- Phase 6 Database architecture + tenant strategy. DONE
- Phase 7 Prisma setup + initial migration. DONE (verified: 97 tables live)
- Phase 8 Authentication: sessions, lockout, reset, rate limit, actor. DONE
- Phase 9 RBAC + policy engine (permission catalog, role templates). DONE
- Phase 10 Tenant/campus administration (transactional provisioning). DONE
- Phase 11 User management + roles UI (verified E2E in browser). DONE

## Architecture as built

- `src/lib/` framework-free: `cn`, `env` (zod), `permissions` (~90 perms).
- `src/server/db/`: Prisma singleton; `tenant.ts` scoping (`tenantScope`,
  `assertSameTenant` -> 404-shaped on mismatch).
- `src/server/auth/`: `password`, `signing` (session JWT + HMAC QR token),
  `session` (create/resolve/revoke + `Actor` build), `rate-limit`, `context`,
  `guards` (`requirePageActor`).
- `src/server/policies/`: `can`/`authorize`/`canAny`/`hasRole`.
- `src/server/services/`: `audit`, `rbac(.seed)`, `tenant`, `dashboard`,
  `user`, `role`.
- UI: 29 shadcn primitives, `DataTable` (TanStack, a11y sort), `PageHeader`
  (breadcrumbs + ruled motif), `EmptyState`, app shell (permission-filtered
  grouped sidebar + tenant switcher + user menu + theme).

## Known issues / cautions

- `package.json#prisma` config key is deprecated (Prisma 7); migrate later.
- Some shadcn primitives (accordion/radio-group/progress/toggle/scroll-area) are
  dependency-free, not Radix. API-compatible; swap later if wanted.
- Badge variants: `neutral|primary|accent|success|warning|info|destructive|outline`.
- `"use server"` files may only export async functions (no const exports).

## Next up (Phase 12)

Student data model + management: `student.service` (list/create/update/archive,
custom fields, sensitive-field gating), students list + detail UI, linking to
the existing enrollment/guardian models.
