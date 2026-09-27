# Project State

> Last updated: Phase 11 complete. Next: Phase 12 (Student data model).

## Current status

| Field | Value |
|---|---|
| Current phase | 30 completed; starting 31 (PPDB admissions) |
| Phases completed | 1-30, 41-50, plus storage abstraction (71 lead-in) |
| Next phase | 31 - PPDB architecture |
| Build state | production build green (45 routes), lint clean, typecheck clean |
| Tests | QR security (10), tenant isolation (7) via `npm run verify`; manual browser E2E |

## Verification (proof of function)

- `npm run verify` -> typecheck 0 errors, eslint 0 problems, QR security 10/10,
  tenant isolation 7/7. `npx next build` -> compiles, 41 routes.
- Real browser E2E at various points: login as `admin@demo.local` -> live
  dashboard -> permission-filtered sidebar -> `/app/users`, `/app/students`,
  `/app/students/[id]`, `/app/classes`, `/app/classes/[id]` (roster), `/app/teachers`,
  `/app/guardians` all render seeded data with **0 console errors**.

## Environment

- Node v26.7.0, npm 11.19.0, git 2.54.0 (Windows, git-bash).
- Local PostgreSQL 16.15 at `.pgsql/` (portable), data dir `.pgdata/`,
  DB `smart_school`, port **5433**, auth `trust`.
- **Known environment issue (resolved):** on this Windows host, launching the
  postmaster via `pg_ctl.exe` makes backend child processes crash with exception
  `0xC0000142`. Fix: launch `postgres.exe` **directly** (see `scripts/pg.sh`).
- Background `next start` servers are reaped by the host after a while; prefer
  build + script-based verification over long-lived servers.
- Secrets live in `.env` (git-ignored). `.env.example` has placeholders only.

## Architectural decisions (see ARCHITECTURE.md for ADRs)

- ADR-0001 Modular monolith over microservices.
- ADR-0002 Shared-schema multi-tenancy, mandatory `tenantId`, compound indexes.
- ADR-0003 Prisma + PostgreSQL (no vendor lock).
- ADR-0004 Signed rotating QR attendance token, no PII in QR.
- ADR-0005 OpenAI-compatible AI provider abstraction.
- ADR-0006 StorageProvider abstraction (local / S3-compatible).
- ID strategy: `cuid()`.

## Database

- Migrations: `20260927163838_init` (97 tables), `add_password_reset_token`,
  `20260927185646_attendance_subject_relation`. See DATABASE.md.
- Schema: `prisma/schema.prisma`. Seed: `prisma/seed.ts` (idempotent).

## Completed phase log

- Phases 1-7 Foundation: env audit, Anti-Slop, ADRs, bootstrap, DESIGN.md,
  tenant strategy, Prisma + initial migration. DONE
- Phase 8 Auth: bcrypt, jose sessions, lockout, reset, rate limit, Actor. DONE
- Phase 9 RBAC + policy engine (~90 perms, 18 role templates). DONE
- Phase 10 Tenant/campus administration (transactional provisioning). DONE
- Phase 11 User management + roles UI. DONE (browser-verified)
- Phase 12 Student model + list/detail UI (sensitive-field gating). DONE
- Phase 13 Teacher/staff module. DONE (browser-verified)
- Phase 14 Guardian module + student linking. DONE (browser-verified)
- Phases 15-17 Academic structure (years/terms, grade levels, classes,
  departments, subjects) + UI. DONE (browser-verified)
- Phases 18-19 Admin shell + permission-aware command palette (Cmd+K). DONE
- Phases 20-22 Student/teacher/guardian management UI/API. DONE
- Phase 23 Enrollment engine (transactional capacity, transfer, bulk). DONE
- Phases 41-47 Attendance + QR: sessions, roster, manual/override, digital
  card with rotating QR, teacher scanner, preview/confirm, replay protection. DONE
- Phases 48-50 Manual override (audited), attendance reporting, QR security test. DONE
- Storage abstraction (local path-safe + S3 SigV4) + file.service + /api/files. DONE
- Phases 24-30 Public site + CMS: block-based pages, publish workflow, posts,
  events, media library; public /s/[tenant] site with draft-leak protection. DONE

## Next up (Phase 31)

PPDB / admissions: `admission.service` — admission periods and tracks, dynamic
application forms (bounded field types), applicant portal with document upload,
admin verification, scoring/workflow, acceptance, and applicant -> student
conversion. Ends with an end-to-end admissions test (Phase 40).

## Known issues / cautions

- `package.json#prisma` config key is deprecated (Prisma 7); migrate later.
- Some shadcn primitives (accordion/radio-group/progress/toggle/scroll-area) are
  dependency-free, not Radix. API-compatible; swap later if wanted.
- Badge variants: `neutral|primary|accent|success|warning|info|destructive|outline`.
- `"use server"` files may only export async functions (no const exports).
- Teacher/guardian modules were built by a subagent that later hit a connection
  error; files compile + pages verified in browser, so the work is complete.
