# Smart School Operating System (SSOS)

Satu platform terpadu operasional digital sekolah. Native, tanpa Docker.

## Stack
- Frontend: Next.js 14 App Router + TypeScript + Tailwind + TanStack Query + Zod
- Backend: NestJS 10 + TypeScript + Prisma ORM
- DB: PostgreSQL 16 (native local service)
- Redis: opsional, graceful fallback
- Worker: proses Node terpisah
- Monorepo: pnpm workspace

## Struktur
- apps/web    : Next.js (login, dashboard; area lain menyusul di UI)
- apps/api    : NestJS REST API (Swagger: /api/docs)
- apps/worker : background worker
- packages/types, packages/ui, packages/config
- scripts     : smoke/test/backup/restore/deploy

## Perintah
pnpm install
pnpm db:migrate / db:seed / db:studio
pnpm dev:api (PORT=4100) / dev:web (3200) / dev:worker
bash scripts/smoke-api.sh http://127.0.0.1:4100
bash scripts/test-students.sh / test-timetable-attendance.sh / test-lms-grades.sh / test-clf.sh / test-sah.sh / test-eoa.sh / test-ia.sh

## Status (lihat DEVELOPMENT_PHASES.md)
Semua 25 fase API selesai. UI menyusul per modul. Detail per fase: IMPLEMENTATION_LOG.md.

## Konvensi
- Tenant scope wajib di semua query privat (schoolId dari membership, bukan input client).
- Authorization server-side (JwtAuthGuard + PermissionsGuard + RequirePermissions).
- Audit trail untuk semua mutasi + READ_SENSITIVE untuk data sensitif (BK/UKS).
- Argon2id password; JWT access 15m; refresh rotation hashed; reuse detection.
- Migration-only (prisma migrate); soft delete untuk riwayat yang tidak boleh hilang.
- AI tidak pernah jadi keputusan final (nilai/PPDB/beasiswa/BK).

## Port (dev box ini dipakai proyek lain)
- 3000: OPEN SID (proyek lain) - jangan pakai
- 3100: Hospital OS (proyek lain) - jangan pakai
- 3200: SSOS web
- 4000: dipakai proyek lain (Ecommer Fashion API kadang restart sendiri)
- 4100: SSOS API

## Deployment
- PM2: ecosystem.config.js (api/web/worker, autorestart)
- scripts/deploy.sh: pull -> install -> build -> migrate deploy -> pm2 reload -> health check
- Backup: scripts/backup-database.sh (retensi 14), restore: scripts/restore-database.sh
