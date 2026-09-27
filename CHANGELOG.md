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
