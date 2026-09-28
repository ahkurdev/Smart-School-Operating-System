# Deployment, Backup & Recovery

The application is a standard Next.js server app backed by PostgreSQL. It runs
on any Node host (VPS, containers, managed platform) and any PostgreSQL provider
— the architecture is deliberately not locked to a vendor.

## 1. Build & run

```bash
npm ci
npm run db:deploy        # apply migrations (never `migrate dev` in prod)
npm run build
npm run start            # serves on $PORT (default 3000)
```

### Environment

Provide the variables from `.env.example` via the platform's secret store. The
app fails fast if required secrets (`SESSION_SECRET`,
`ATTENDANCE_SIGNING_KEY`, `ENCRYPTION_KEY`, `DATABASE_URL`) are missing or too
short. Rotate secrets by deploying new values and restarting; sessions signed
with the old key are invalidated.

### Providers

| Concern | Local (dev) | Production options |
| --- | --- | --- |
| Database | bundled `.pgsql/` on :5433 | Neon, Railway, Render, RDS, Cloud SQL, Azure PG, self-hosted |
| Files | `STORAGE_PROVIDER=local` | any S3-compatible bucket (S3, R2, MinIO, B2) |
| AI | `mock` | any OpenAI-compatible endpoint |
| Email | `console` | SMTP provider |

Switching providers is configuration-only — the code talks to abstractions
(`StorageProvider`, the AI provider interface, the email provider).

## 2. Migrations

- Development: `npm run db:migrate` (creates a migration from schema changes).
- Production/CI: `npm run db:deploy` (applies committed migrations only).
- **Never** edit the database by hand; every change is a migration in
  `prisma/migrations`.
- Destructive changes: back up first (§3), review the generated SQL for data
  loss, and prefer expand/contract (add column → backfill → switch → drop).

## 3. Backup

### Database (PostgreSQL)

```bash
# Logical backup (recommended baseline)
pg_dump --format=custom --no-owner "$DATABASE_URL" > backup-$(date +%F).dump

# Restore into a fresh database
createdb smart_school_restore
pg_restore --no-owner --dbname=smart_school_restore backup-2026-01-01.dump
```

Managed providers offer automated PITR — enable it and verify retention.

### Files

Object storage should have versioning + lifecycle rules enabled. For the local
provider, back up `STORAGE_LOCAL_DIR`.

## 4. Recovery procedures

1. **Bad deploy** → roll back to the previous release; migrations are
   forward-only, so only roll back code if the schema is still compatible.
2. **Bad migration** → restore the pre-migration dump into a staging DB, ship a
   corrective migration, then deploy.
3. **Data loss** → restore the latest dump + replay WAL/PITR if available; files
   from object storage versions.
4. **Disaster** → provision a new database from the latest backup, point
   `DATABASE_URL` at it, redeploy, verify with `npm run verify`.

**Test restores** in staging at least quarterly — an untested backup is not a
backup.

## 5. Health & rollback checklist

- [ ] `npm run build` green and `npm run verify` green on the release commit.
- [ ] Migrations reviewed for destructive operations.
- [ ] Fresh backup taken before deploying migrations.
- [ ] Secrets present in the target environment.
- [ ] Smoke test after deploy: `/login`, public site `/s/<slug>`, `xyrz/claude-fable-5`.
- [ ] Monitoring/alerts receiving logs.

## 6. CI/CD

`.github/workflows/ci.yml` runs install → prisma generate → migrate deploy →
seed → typecheck → lint → full test suite → production build against a throwaway
PostgreSQL service. Wire your host to deploy on green `main`.
