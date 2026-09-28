# Changelog

All notable changes to Smart School Operating System. Conventional Commits style.

## [Unreleased]

### Added
- Repository bootstrap: Next.js 15 App Router, React 19, TypeScript strict,
  Tailwind CSS, shadcn/ui primitives, design tokens.
- Anti-Slop agent rules (`anti-slop/`, `.agents/`).
- Architecture documentation with ADRs (`ARCHITECTURE.md`).
- Design direction (`DESIGN.md`).
- Prisma schema: 96 models / 50 enums covering tenancy, identity, academics,
  attendance + QR, admissions (PPDB), CMS, library, finance, assets,
  extracurricular, counseling, discipline, documents, AI, API, audit.
- Initial migration `20260927163838_init` (97 tables) applied to local Postgres.
- `scripts/pg.sh` dev Postgres control (direct-launch workaround for the
  Windows `0xC0000142` child-process crash).
- `scripts/ensure-db.mjs` database creation helper.

### Fixed
- Completed the incomplete portable PostgreSQL binaries in `.pgsql/`.
- Fixed local `.env` `DATABASE_URL` for the trust-auth dev server.
- Established `PROJECT_STATE.md`, `ROADMAP.md`, `CHANGELOG.md`.

### Added (Phase 8-10)
- Authentication foundation: bcrypt, jose sessions, lockout, reset, rate limit.
- RBAC policy engine (~90 permissions, 18 role templates), tenant provisioning.
- Admin app shell (permission-filtered sidebar, tenant switcher, dashboard).

### Added (Phase 11)
- User management (list/create/update/roles/status/reset) + roles UI.
- Shared `DataTable` (TanStack, accessible sorting) and `PageHeader` breadcrumbs.

### Added (Phase 12)
- Student data model: `student.service` with tenant-scoped reads and
  permission-gated sensitive fields (medical/special-ed).
- Students list (search, status/campus filters, pagination) and student detail
  (profile, enrollment, guardians, restricted notes) with create/edit dialogs.

## [Phase 71–100] — feature completion & production readiness

### Added
- **Operations:** library (catalog/copies/loans/reservations), assets, facility
  booking (transactional overlap checks), extracurricular, achievements,
  counseling (student-scoped), discipline, secure documents.
- **Data:** import/export with a native RFC-4180 CSV parser and SpreadsheetML
  2003 XLSX writer (no new dependencies), reporting engine, accessible
  dependency-free SVG charts, analytics, academic-risk indicators.
- **AI:** provider abstraction (`openai-compatible` + deterministic `mock`),
  permission-aware tool layer that re-authorises at execution time, tool-call
  cap, admin/teacher/student assistants, conversation + usage + tool-call audit.
- **Platform:** versioned public API (`xyrz/claude-fable-5`) authenticated by hashed
  API keys with scopes, HMAC-SHA256 signed webhooks, background-job queue with
  retry bookkeeping, integrations admin UI.
- **Notifications:** notification center (per-user in-app messages, tenant
  fan-out, read/purge scoping, provider abstraction, delivery job handler) and
  the audit-trail viewer (filtered, paginated).
- **Settings:** school profile + feature flags + per-tenant data retention
  (delete/anonymize, dry-run, audited).
- **Caching:** request-scoped dedupe + TTL memo with an explicit tenant-key
  guard.

### Security
- Strict `Content-Security-Policy`, HSTS (prod), `frame-ancestors 'none'`, COOP,
  hardened `Permissions-Policy`; security headers verified live.
- Per-tenant retention and redacted audit trail; verified tenant isolation.

### Fixed (Phase 99 audit)
- **Migrations baselined** to match the full schema: replaced three partial
  migrations with one complete `20260928000000_baseline` (50 enums, 97 tables).
  A fresh DB now builds the whole schema via `migrate deploy` (was partial).
- Eliminated the last two page stubs; removed dead `phase-stub*` components.
- Recovered a corrupt `node_modules` caused by a breaking `npm audit fix`.

### Docs & CI
- `README.md`, `SECURITY.md`, `DEPLOYMENT.md`, `AI.md`, `ATTENDANCE.md`,
  `PPDB.md`, `CONTRIBUTING.md`; `ROADMAP.md`/`PROJECT_STATE.md` set to Phase 100.
- GitHub Actions CI: Postgres service → migrate deploy → seed → typecheck →
  lint → full suite → production build.

### Tests
- 14 suites / 213 checks, all green, verified in a clean room.
