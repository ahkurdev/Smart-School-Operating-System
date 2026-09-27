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
