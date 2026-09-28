# Smart School Operating System

A modular, multi-tenant **School Operating System**: public website + CMS, PPDB
(online admissions), Student Information System, timetabling, dynamic QR
attendance, gradebook, assignments, exams, library, finance, assets, documents,
analytics, an AI assistant, API/webhooks, audit trail and administration tools —
in one integrated platform.

Built with **Next.js (App Router) · TypeScript · Prisma · PostgreSQL**, designed
to run any institution — SD/SMP/SMA/SMK, madrasah, international, private or
public school, single- or multi-campus — from configuration, not code changes.

---

## Quick start (new developer)

```bash
git clone <repo-url> smart-school-os
cd smart-school-os
npm install                 # also runs `prisma generate`

cp .env.example .env        # then fill in the values (see below)

# Start a local PostgreSQL (bundled portable build) — or point DATABASE_URL
# at your own PostgreSQL (local, Neon, RDS, Cloud SQL, ...).
bash scripts/pg.sh start

npm run db:deploy           # apply migrations
npm run db:seed             # create the demo tenant + realistic sample data
npm run dev                 # http://localhost:3000
```

### Required environment

Copy `.env.example` → `.env`. The minimum to boot:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | 32-byte base64 secret for session signing |
| `ATTENDANCE_SIGNING_KEY` | 32-byte base64 key for rotating QR tokens |
| `ENCRYPTION_KEY` | 32-byte base64 key for at-rest field encryption |

Generate secrets with `openssl rand -base64 32`. Optional integrations
(storage, AI, email, payments) default to safe local adapters — see
`.env.example` for the full list. **Never commit `.env`.**

### Seeded logins

The seed prints the demo tenant slug and credentials. All demo data is fictional.

---

## Common commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | ESLint |
| `npm run verify` | Typecheck + lint + the full test suite |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations (production/CI) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Browse the database |
| `npm run db:reset` | Drop, re-migrate and re-seed |

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — modules, boundaries, request flow
- [DESIGN.md](./DESIGN.md) — design language & tokens
- [DATABASE.md](./DATABASE.md) — schema, migrations, tenancy
- [SECURITY.md](./SECURITY.md) — threat model & controls
- [ATTENDANCE.md](./ATTENDANCE.md) — QR attendance design
- [PPDB.md](./PPDB.md) — admissions flow
- [AI.md](./AI.md) — assistant architecture & guardrails
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploy, backup & recovery
- [TESTING.md](./TESTING.md) — test strategy
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute
- [ROADMAP.md](./ROADMAP.md) — phase plan
- [PROJECT_STATE.md](./PROJECT_STATE.md) — current build state

---

## License

Proprietary / internal. No license granted for redistribution unless agreed.
