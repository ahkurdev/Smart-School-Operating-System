# Architecture

Smart School Operating System (SSOS) is a modular, multi-tenant school platform.

## Style: Modular Monolith

One deployable Next.js application with strict internal boundaries. Modules talk to
each other through service functions and events, never by reaching into each other's
tables. This keeps operation simple (one process, one database, one migration stream)
while leaving clean seams so a module (for example `finance` or `ai`) can be extracted
later without a rewrite.

We deliberately avoid for now: microservices, Kubernetes, event sourcing, CQRS, Kafka,
service mesh. None of them are justified by the current scale, and all of them add
operational cost.

## Layers

```
src/
  app/            Next.js App Router (public site, portals, admin, API routes)
  components/     ui/ (shadcn primitives), shared/, layout/
  features/       domain UI + client logic, grouped by module
  server/
    auth/         session, password hashing, MFA, JWT/QR token signing
    db/           Prisma client singleton, tenant-scoped helpers
    services/     business logic (the only place that mutates domain data)
    policies/     authorization: permission checks + tenant guards
    jobs/         background job queue abstraction
    storage/      StorageProvider abstraction (local / S3-compatible)
    ai/           AI provider abstraction + permission-aware tools
  lib/            framework-agnostic utilities (no React, no Prisma)
  types/          shared TypeScript types
  styles/         global CSS + design tokens
```

The rules:

- `app/` may call `server/services`. It must not import Prisma directly for mutations.
- `server/services` is the only layer that writes domain data, and each function takes
  an explicit `actor` (user + tenant + permissions) so authorization is never implied.
- `server/policies` answers "may this actor do X to Y" and is called by services, not
  by the UI. UI checks are for affordance only; the server is the authority.
- `lib/` never imports from `server/` or `components/`.

## Multi-tenancy

The tenant is `Tenant` (an organization: a school, a district, a training institute).
Under it sit `Campus`, `AcademicYear`, `User`, `Student`, `Teacher`, etc.

**Isolation rule:** every tenant-scoped table carries `tenantId`. Every read and write
that touches tenant data goes through `tenantScope(actor)` which forces `tenantId =
actor.tenantId`. There is no code path that filters by tenant only in the UI.

We use a shared-database, shared-schema model with a mandatory `tenantId` column and
compound indexes `(tenantId, ...)`. This is simple, cheap, and enough for the target
scale. A row-level-security (RLS) hardening pass is documented in `SECURITY.md` as the
next step if a deployment needs defense-in-depth at the database layer.

## Identity & authorization

- `User` is global (a person can be a parent at one school and a teacher at another).
- `Membership` links a `User` to a `Tenant` with a set of roles.
- RBAC: `Role` -> `RolePermission` -> `Permission` (`subject.action`, e.g. `student.read`).
- Permission checks are `can(actor, "student.update", { tenantId, resource })`.
- Roles are per-tenant and customisable; the seed provides sensible defaults.

## Attendance & QR (security-critical)

The QR on a student card is **not** identity data. It is a short-lived, signed,
rotating token:

```
payload = { v, tenantId, studentId, issuedAt, expiresAt, nonce }
token   = base64url(payload) + "." + HMAC_SHA256(payload, ATTENDANCE_SIGNING_KEY)
```

- Issued by the server to an authenticated student for their own enrollment only.
- Verified by the server when a teacher scans: signature, expiry, nonce freshness,
  tenant match, session open, student enrolled, teacher authorised.
- Replay protection: the nonce is single-use inside an attendance session; a consumed
  or expired token is rejected. A screenshot of an old QR is dead after ~30s.

The signing key is server-only (`ATTENDANCE_SIGNING_KEY`). The QR never contains the
photo, name, address, or national ID.

## Storage

`StorageProvider` interface with two implementations: `LocalStorage` (dev) and
`S3Storage` (S3-compatible: AWS, R2, MinIO). The database stores only metadata
(`FileObject`) and an opaque key; access is mediated by signed, expiring URLs.

## AI

`AIProvider` abstraction speaks the OpenAI-compatible chat/tools protocol, so the
model and base URL are configuration (`AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`).
The AI never gets a database connection. It gets a fixed, permission-checked tool
allowlist; each tool runs as the calling `actor`, so the model can only see what the
user could see. All tool calls are written to `AIToolCall` / `AIUsage`.

## Background jobs

`JobQueue` interface. Dev uses an in-process adapter; production can swap a
Redis/Postgres-backed adapter. Jobs: email, report generation, scheduled publishing,
webhooks, imports, AI runs.

## Data flow example (QR attendance)

```
Student client  ->  GET /api/v1/attendance/token      (own enrollment only)
server          ->  sign token, return { token, expiresAt }
Student client  ->  render QR (rotates client-side before expiry)
Teacher scanner ->  POST /api/v1/attendance/scan       { token, sessionId }
server          ->  verify signature/expiry/nonce/tenant/session/enrollment/role
server          ->  return student confirmation card (server-built, minimal fields)
Teacher         ->  POST /api/v1/attendance/confirm    { sessionId, studentId, tokenId }
server          ->  transactional insert AttendanceRecord + consume nonce + audit
```

## Decision records

See `ARCHITECTURE.md` (this file) and the ADR log below.

### ADR-0001: Modular monolith over microservices
Status: accepted. Reason: team size and scale do not justify distributed complexity;
modular boundaries keep the extraction option open.

### ADR-0002: Shared-schema multi-tenancy with mandatory tenantId
Status: accepted. Reason: simplest correct model for the scale; RLS documented as a
later hardening layer.

### ADR-0003: Prisma + PostgreSQL
Status: accepted. Reason: typed schema, real migrations, no vendor lock (plain
PostgreSQL wire protocol).

### ADR-0004: Signed rotating QR, no PII in QR
Status: accepted. Reason: screenshots must not leak identity; short TTL plus nonce
gives replay resistance without hardware.

### ADR-0005: OpenAI-compatible AI abstraction
Status: accepted. Reason: avoid provider lock; the same tool protocol works across
OpenAI, Anthropic-compatible gateways, and local servers.

### ADR-0006: Storage provider abstraction
Status: accepted. Reason: dev must run with zero cloud setup; production uses S3.
