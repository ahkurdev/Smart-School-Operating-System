# Project State

> Last updated: **PHASE 100 — production readiness verification.**

## Current status

| Field | Value |
|---|---|
| Current phase | **100 (final) — verified** |
| Phases completed | **1–100** |
| Build state | production build green (56 routes), lint clean, typecheck clean |
| Tests | **15 suites / 230 checks**, all passing (see below) |
| Stack | Next.js 15 (App Router) · React · TypeScript (strict) · Prisma 6 · PostgreSQL |

## Verification (proof of function — clean room)

A full **clean-room** run was performed on a throwaway database:
`prisma migrate deploy` (single baseline migration) → **98 tables** → `db:seed`
→ all **15 test suites (230 checks) pass**. `prisma migrate diff` reports
**no drift** between the database and `prisma/schema.prisma`.

### Test suites (`npm run verify`)

| Suite | Checks | Covers |
|---|---|---|
| `test:qr` | 10 | QR attendance: valid/expired/tampered/replay/wrong-tenant/wrong-session/closed/unauth/duplicate/override |
| `test:isolation` | 7 | Tenant isolation |
| `test:admissions` | 15 | PPDB E2E incl. applicant→student conversion |
| `test:timetable` | 9 | Class/teacher/room collision detection |
| `test:work` | 18 | Assignments + gradebook publish workflow |
| `test:ops` | 18 | Announcements + finance (derived status) |
| `test:library` | 20 | Catalog, copies, loans, reservations |
| `test:assets` | 12 | Assets + facility booking overlap |
| `test:activities` | 15 | Extracurricular, achievements, counseling, discipline |
| `test:data` | 24 | CSV round-trip, import preview/validation, reporting, risk |
| `test:ai` | 17 | AI permission-aware tools, tool-call cap, audit, conversation scoping |
| `test:platform` | 18 | API keys (hashed/scopes/revoke), webhook signing+delivery, job queue |
| `test:retention` | 16 | TTL cache, tenant keys, retention apply + isolation |
| `test:notify` | 14 | Notification fan-out, read scoping, audit trail listing |
| `test:acceptance` | 17 | Full E2E: setup→CMS→PPDB→QR attendance→grades→AI→audit→isolation |

### Real browser evidence

Production server (`next start`): `/login` and public `/s/demo-school` → **200**,
**0 console errors**, **0 hydration errors**, **no horizontal overflow**;
`/api/v1/*` → **401** without a key (typed error, no stack leak); all security
headers live (CSP, `X-Frame-Options: DENY`, HSTS, COOP, Permissions-Policy).

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

- Migrations: single baseline `20260928000000_baseline` (50 enums, 97 tables)
  generated via `prisma migrate diff --from-empty`. Replaced the earlier three
  partial migrations (see Remediation log).
- Schema: `prisma/schema.prisma` (97 models). Seed: `prisma/seed.ts` (idempotent,
  realistic dummy data: Demo International School, staff, students, guardians,
  subjects, timetable, applicants, attendance, grades, announcements).

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
- Phases 31-40 PPDB admissions: periods, tracks, dynamic forms, applicant
  portal with uploads, verification, scoring/ranking, decisions, and
  idempotent applicant -> student conversion. E2E test: 15 checks. DONE
- Phases 51-55 Timetable: schedule periods, weekly entries, class/teacher/room
  collision detection, class grid editor. Test: 9 checks. DONE
- Phases 56-58 Role-aware dashboards: teacher / student / parent landing
  panels from live data. DONE
- Phases 59-65 Assignments, materials, gradebook: submissions with enrolment
  + publish gating, weighted averages, DRAFT->SUBMITTED->APPROVED->PUBLISHED
  workflow. Test: 18 checks. DONE
- Phases 66-70 Report cards, announcements, finance: frozen grade/attendance
  snapshots, draft-leak-safe announcements with acknowledgement, invoices whose
  status is derived from payments. Test: 18 checks. DONE
- Phases 71-78 Library, assets, facility booking, extracurricular, achievements,
  counseling, discipline. Tests: 20+12+15 checks. DONE
- Phases 79-83 Secure documents, import/export (native CSV+XLSX), reporting,
  analytics, academic-risk indicators. Test: 24 checks. DONE
- Phases 84-89 AI provider abstraction, permission-aware tools, admin/teacher/
  student assistants, AI audit. Test: 17 checks. DONE
- Phases 90-91 Public API v1 (hashed keys + scopes), HMAC webhooks, background
  jobs. Test: 18 checks. DONE
- Phases 92-94 Caching (tenant-safe), security hardening (strict CSP/HSTS),
  privacy + retention. Test: 16 checks. DONE
- Phases 95-98 Test coverage, accessibility/responsive checks, browser/perf
  audit, CI/CD + deployment/backup docs. DONE
- Phases 99-100 Full-system audit + remediation, production-readiness
  verification (clean room; 15 suites / 230 checks). DONE

## Remediation log (Phase 99 findings — fixed, not just reported)

1. **Migrations did not match the schema.** The DB had 98 tables but only 3
   partial migrations (the rest applied via `db push`), so `migrate deploy` on a
   fresh database produced a partial schema. **Fixed:** replaced them with one
   complete baseline (`prisma migrate diff --from-empty`); verified 98 tables on
   a clean DB; dev history reconciled via `migrate resolve --applied`.
2. **Two page stubs remained** (audit log, notifications) and the `Notification`
   model was never written to. **Fixed:** built the audit-trail viewer
   (filtered + paginated) and the notification center (fan-out, read/purge
   scoping, provider abstraction, delivery job). **Zero** `PhaseStubPage` usages
   remain.
3. **Dead code**: removed unused `phase-stub*` components after #2.
4. **Corrupt install**: a `npm audit fix` (non-force) broke `@types/node` /
   `lucide-react` types. **Fixed:** restored the committed lockfile + clean
   `npm ci`; typecheck/lint/tests green again.
5. **Dependency audit**: 2 advisories remain in build-time tooling
   (`prisma` config loader → deepmerge-ts; `next` bundled postcss). Fixes
   require `--force` (breaking major bumps) and are **not** in shipped runtime
   code — tracked, not force-upgraded.

## Known issues / cautions

- **Dependency advisories (build tooling only):** `deepmerge-ts` via
  `@prisma/config` and `postcss` bundled in `next`. Both are dev/build-path;
  remediate on the next Prisma/Next major upgrade. Do **not** run
  `npm audit fix --force` (it broke the toolchain once already).
- `package.json#prisma` config key is deprecated (Prisma 7); migrate to
  `prisma.config.ts` on the next Prisma major.
- Some shadcn primitives (accordion/radio-group/progress/toggle/scroll-area) are
  dependency-free, not Radix. API-compatible; swap later if wanted.
- Badge variants: `neutral|primary|accent|success|warning|info|destructive|outline`.
- `"use server"` files may only export async functions (no const exports).
- AI defaults to the `mock` provider when `AI_PROVIDER=mock` (used by tests);
  production uses the configured OpenAI-compatible endpoint.

## Resuming in a new session

1. Read this file, `ROADMAP.md`, `ARCHITECTURE.md`, `DESIGN.md`.
2. `bash scripts/pg.sh start` (Postgres on :5433).
3. `npm run verify` (typecheck + lint + 15 suites) to confirm green.
4. `npm run build` for the production build.
5. The project is feature-complete through Phase 100; further work is
   enhancement, not completion.
