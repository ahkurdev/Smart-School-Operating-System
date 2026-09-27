# Project State

> Last updated: Phase 7 complete. Next: Phase 8 (Authentication foundation).

## Current status

| Field | Value |
|---|---|
| Current phase | 7 completed, starting 8 |
| Phases completed | 1,2,3,4,5,6,7 |
| Next phase | 8 - Authentication foundation |
| Build state | schema valid, migration applied, Prisma client generated |
| Tests | not yet wired (added from Phase 8 onward) |

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

## Known issues / cautions

- Next.js 15 + React 19: verify all `@types` align before first build.
- `package.json#prisma` config key is deprecated (Prisma 7); acceptable for now,
  migrate to `prisma.config.ts` later if needed.

## Next up (Phase 8)

Authentication foundation: session model usage, password hashing (bcryptjs),
session cookies (jose JWT), login/logout, rate limiting, login history,
password reset scaffolding, MFA (otplib) scaffolding, server-side `actor` type.
