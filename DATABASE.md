# Database Reference

Smart School Operating System (SSOS) persistence layer. This document describes
the database **as actually built** in this repository. Where the schema and the
running database differ from older prose in `PROJECT_STATE.md`, this file is
authoritative and the discrepancy is called out.

---

## 1. Stack and connection

| Aspect | Value |
|---|---|
| Database | PostgreSQL |
| ORM | Prisma (`prisma-client-js`), `@prisma/client` ^6.3.1 |
| Schema file | `prisma/schema.prisma` |
| Datasource | `env("DATABASE_URL")` |
| Local dev server | Portable PostgreSQL 16.15 under `.pgsql/`, data dir `.pgdata/` |
| Local dev port | **5433** (not the default 5432) |
| Local auth | `trust` (dev only) |
| Dev database name | `smart_school` |

`DATABASE_URL` for local development (from `.env.example`):

```
postgresql://postgres@127.0.0.1:5433/smart_school?schema=public
```

The Prisma client is a process-wide singleton created in
`src/server/db/client.ts` (guarded against Next.js hot-reload connection-pool
growth). Every service imports `prisma` from that module; there is no second
client instance.

### Dev database helpers

- `scripts/pg.sh {start|stop|status|psql}` — controls the project-local Postgres.
  On this Windows host `pg_ctl.exe` makes backend children crash with exception
  `0xC0000142`, so the script launches `postgres.exe` **directly** and polls the
  port for readiness instead of using `pg_ctl -w`. `stop` still uses `pg_ctl`.
- `scripts/ensure-db.mjs` — creates the application database if it is missing by
  connecting to the default `postgres` database (run with `node`).

### npm scripts that touch the database

```
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev
npm run db:deploy     # prisma migrate deploy
npm run db:push       # prisma db push
npm run db:seed       # tsx prisma/seed.ts
npm run db:studio     # prisma studio
npm run db:reset      # prisma migrate reset --force
```

`package.json` also carries a `prisma.seed` key (`tsx prisma/seed.ts`). That
`package.json#prisma` config key is **deprecated in Prisma 7** and should be
migrated to `prisma.config.ts` later.

---

## 2. Scale (verified against the files and the live DB)

| Metric | Count | Source |
|---|---|---|
| Prisma models | **97** | `grep -c '^model ' prisma/schema.prisma` |
| Prisma enums | **50** | `grep -c '^enum ' prisma/schema.prisma` |
| `CREATE TABLE` in migrations | 96 + 1 = **97** | both migration files |
| Tables in live DB `public` schema | **98** (97 domain + `_prisma_migrations`) | `information_schema.tables` |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` in init migration | **182** | init `migration.sql` |
| Migrations applied | **2** | `_prisma_migrations` |

> **Discrepancy with `PROJECT_STATE.md`:** that file says "Single migration:
> `20260927163838_init` (97 tables, 50 enums)." There are now **two**
> migrations; `20260927164225_add_password_reset_token` was added afterwards
> (it adds the one `PasswordResetToken` table). A `97` model count is correct;
> note models ≠ tables once the `_prisma_migrations` bookkeeping table is
> included (98).

---

## 3. Migrations

Migrations live in `prisma/migrations/` and are committed to version control.
`migration_lock.toml` pins the provider to `postgresql`.

| Migration | Applied | Contents |
|---|---|---|
| `20260927163838_init` | 2026-09-27 23:38 | Full schema: 96 tables, 50 enum types, 182 indexes. 2699 SQL lines. |
| `20260927164225_add_password_reset_token` | 2026-09-27 23:42 | Adds the `PasswordResetToken` table (23 SQL lines). |

Deploy with `npm run db:migrate` (dev) or `npm run db:deploy` (non-interactive /
CI / production). Never edit an applied migration; add a new one.

---

## 4. Identity and naming conventions

Documented at the top of `prisma/schema.prisma` and enforced by hand:

- Models `PascalCase`; fields `camelCase`; enum values `SCREAMING_SNAKE_CASE`.
- Primary keys are `String @id @default(cuid())` — portable, opaque,
  collision-free, roughly sortable. No auto-increment integers, so IDs never
  leak row counts or allow enumeration.
- Every **tenant-scoped** model carries `tenantId` and is indexed on
  `(tenantId, …)` for the real query shapes.
- Nullable soft-delete column `deletedAt DateTime?` on the models that need
  archival (Tenant, Campus, User, Student, Teacher, Guardian, Classroom,
  Subject, Assignment, Assessment, LearningMaterial, Announcement, LibraryItem,
  Asset, CmsPage, Post, Document, FileObject, …). A soft delete is a filtered
  read, not a physical delete.
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt` where an
  update path exists.
- JSON columns use Prisma `Json` with string defaults, e.g.
  `gradingScale Json @default("{\"type\":\"numeric\",\"min\":0,\"max\":100,\"pass\":60}")`.

---

## 5. Multi-tenancy model

**Shared database, shared schema, mandatory `tenantId`** (ADR-0002). The tenant
is the organization (`Tenant`); `Campus`, `AcademicYear`, `Student`, `Teacher`,
`Classroom`, `Role`, etc. hang beneath it.

Isolation is enforced **in the service layer**, not the database. There is no
row-level security (RLS) yet — it is documented as the next hardening step in
`ARCHITECTURE.md`. The single auditable chokepoint is
`src/server/db/tenant.ts`:

| Helper | Purpose |
|---|---|
| `requireTenantId(actor)` | Returns `actor.tenantId` or throws `forbidden`. |
| `tenantScope(actor, {allowAll})` | Produces a Prisma `where` fragment `{ tenantId }`. Platform actors may pass `{ allowAll: true }` for genuine cross-tenant admin work — explicit and visible at the call site. |
| `scoped(actor, where, opts)` | Merges the tenant scope into an existing `where`. Preferred over hand-writing `{ tenantId }`. |
| `assertSameTenant(actor, resourceTenantId, opts)` | IDOR defence. On mismatch throws a **404-shaped** not-found (never confirms another tenant's data exists). |

Every service function takes an explicit `Actor` (`src/types/actor.ts`) and
begins with `authorize(actor, "<permission>")` followed by
`requireTenantId(actor)`; queries are then filtered by `tenantId` in the `where`
clause. Examples: `student.service.ts`, `academic.service.ts`,
`user.service.ts`, `role.service.ts`, `tenant.service.ts`.

Two models are intentionally **not** tenant-scoped (global or optional tenant):
`Permission` (global catalog, `key @unique`), `Role.tenantId` is nullable
(`null` = platform role template), and `User` is global so one person can be a
parent at one school and a teacher at another.

---

## 6. Model catalog (all 97, grouped as in the schema)

### Tenancy & identity
`Tenant`, `Campus`, `User`, `Membership`, `Role`, `Permission`, `RolePermission`,
`UserRole`, `Session`, `LoginAttempt`, `PasswordResetToken`

Key points:
- `Tenant` holds all per-school configuration and **nothing school-specific is
  hardcoded**: `timezone`, `locale`, `currency`, `primaryColor`, `gradeLabel`,
  `classLabel`, `studentIdLabel`, `academicTermsPerYear`, `gradingScale (Json)`,
  `featureFlags (Json)`. Default feature flags cover
  `admission, library, finance, ai, counseling, discipline, facility,
  extracurricular`.
- `Membership` (`@@unique([tenantId, userId])`) links a global `User` to a
  `Tenant`; a user can hold memberships in many tenants.
- RBAC chain: `Role → RolePermission → Permission`. `Permission.key` is an
  `@@unique` `subject.action` string (e.g. `student.read`), with scalar `subject`,
  `action`, `category` columns for grouping. `UserRole` joins a `Membership` to a
  `Role` (`@@id([membershipId, roleId])`).
- `Session` stores only `tokenHash` (SHA-256 of the raw cookie token), an
  optional `activeTenantId`, and `revokedAt`/`expiresAt` — the DB row is the
  source of truth, so revoking a row invalidates an unexpired JWT.
- `LoginAttempt` records every sign-in attempt (success/failure + `reason`);
  `PasswordResetToken` stores only a `tokenHash`.

### Academic structure
`AcademicYear`, `AcademicTerm`, `GradeLevel`, `Department`, `Subject`,
`Curriculum`, `Classroom`, `Room`, `Enrollment`, `TeacherAssignment`

Key points:
- `AcademicYear` (`@@unique([tenantId, name])`) → `AcademicTerm`
  (`@@unique([academicYearId, sequence])`).
- `GradeLevel` is data (`name`, `code`, `sequence`, `stage`), not an enum — so
  "Grade 10", "Year 11", "Kelas 10" all work without schema change.
- `Subject` (`@@unique([tenantId, code])`) optionally belongs to a `Department`.
- `Classroom` links campus/year/grade level + homeroom teacher; `Enrollment`
  is `@@unique([studentId, academicYearId])` (one enrollment per student per
  year) with a status enum (`ACTIVE, TRANSFERRED, GRADUATED, WITHDRAWN,
  SUSPENDED`).
- `Room` has a `RoomType` enum and a `facilities Json @default("[]")` column.

### People
`Student`, `Teacher`, `Staff`, `Guardian`, `StudentGuardian`

Key points:
- `Student`, `Teacher`, `Guardian` each have an optional `userId`
  (`@unique` on Student/Teacher/Guardian) so a person *may* have a login.
- Uniqueness is per tenant: `Student @@unique([tenantId, studentNumber])`,
  `Teacher @@unique([tenantId, employeeNumber])`.
- `Student` carries **sensitive** fields `medicalNotes` and `specialEdNotes`,
  gated by the `student.read_sensitive` permission at the service layer
  (see `student.service.ts`; when absent, columns are not selected and a
  `sensitiveRedacted` flag is returned).
- `Student.guardians` is the `StudentGuardian` join (`@@id([studentId,
  guardianId])`) with `relationship`, `isPrimary`, `canPickup`,
  `hasPortalAccess`.

### Attendance
`AttendanceSession`, `AttendanceRecord`, `AttendanceToken`

Security-critical (ADR-0004). The QR is **not** identity data — it is a
short-lived, HMAC-signed, rotating token with no PII.

- `AttendanceSession` carries an optional geo-fence (`latitude`, `longitude`,
  `radiusMeters`), a `gracePeriodMinutes` default of 10, and a status enum
  (`SCHEDULED, OPEN, CLOSED, CANCELLED`).
- `AttendanceRecord` is `@@unique([sessionId, studentId])` **and**
  `@@unique([sessionId, teacherId])`; it supports manual override
  (`overriddenByUserId`, `overrideReason`, `overriddenAt`) and a `method` enum
  (`QR, MANUAL, IMPORT, SYSTEM`).
- `AttendanceToken` stores a single-use `nonce` (`@unique`), `expiresAt` and
  `consumedAt`; the signing/verification logic lives in
  `src/server/auth/signing.ts` (`signAttendanceToken` / `verifyAttendanceToken`,
  format `v1.<payloadB64>.<sigB64>`, HMAC-SHA256, TTL from
  `ATTENDANCE_TOKEN_TTL_SECONDS`, default 30s).

### Timetable
`SchedulePeriod`, `TimetableEntry`, `Holiday`

`TimetableEntry` references classroom, subject, optional teacher/room/period and
carries `dayOfWeek`, `startTime`, `endTime`, `isRecurring`, `effectiveFrom/To`,
and three `(tenantId, …)` indexes for the day lookups (by year, teacher, room).

### Assignments, assessments, grades
`Assignment`, `AssignmentSubmission`, `Assessment`, `GradeComponent`, `Grade`,
`ReportCard`, `LearningMaterial`, `Exam`, `ExamParticipant`, plus enums
`SubmissionStatus`, `AssessmentType`, `GradeStatus`, `ReportCardStatus`,
`MaterialType`, `ExamStatus`, `PublishStatus`.

- `AssignmentSubmission` is `@@unique([assignmentId, studentId])`.
- `Grade` is `@@unique([assessmentId, studentId])` and moves through
  `GradeStatus` (`DRAFT → SUBMITTED → APPROVED → PUBLISHED`).
- `ReportCard` is `@@unique([studentId, academicYearId, termId])` and stores
  rendered `grades Json` and `attendanceSummary Json`.

### CMS / public site
`CmsPage`, `CmsBlock`, `Post`, `Category`, `Event`, `Gallery`, `GalleryItem`,
`MediaAsset`

- `CmsPage` (`@@unique([tenantId, slug])`) contains ordered `CmsBlock`s of a
  fixed `CmsBlockType` enum (HEADING, RICH_TEXT, IMAGE, CTA, STATISTICS,
  STAFF_LISTING, …).
- `Post` (`@@unique([tenantId, slug])`) has a `PostType` enum
  (`NEWS, ANNOUNCEMENT, ARTICLE, BLOG`).

### Admissions / PPDB
`AdmissionPeriod`, `AdmissionTrack`, `ApplicationForm`, `ApplicationField`,
`Applicant`, `Application`, `ApplicationValue`, `ApplicationDocument`,
`AdmissionDecision`

- Dynamic forms: `ApplicationField.type` is a 16-value `ApplicationFieldType`
  enum, with `options Json`, `validation Json`, `conditionalOn Json`.
- `Application` (`@@unique([tenantId, applicationNumber])`) has a 13-state
  `ApplicationStatus` workflow (DRAFT → … → ACCEPTED / WAITLISTED / REJECTED /
  RE_REGISTERED / WITHDRAWN).
- `ApplicationValue` is `@@unique([applicationId, fieldId])`; `AdmissionDecision`
  is `@unique` on `applicationId`.

### Library
`LibraryItem`, `LibraryCopy`, `LibraryLoan`, `LibraryReservation`

`LibraryItem.type` is `PHYSICAL | EBOOK | DOCUMENT | LINK`; `LibraryCopy` is
`@@unique([tenantId, barcode])` with a 6-state status. `LibraryLoan` tracks
`renewals`, `fineAmount`, `finePaid`, `status`.

### Finance
`FeeType`, `Invoice`, `InvoiceItem`, `Payment`

`Invoice` (`@@unique([tenantId, invoiceNumber])`) tracks subtotal/discount/total/
paidAmount and an `InvoiceStatus` enum (UNPAID, PARTIAL, PAID, OVERDUE, WAIVED,
CANCELLED, REFUNDED). `Payment.method` is a `PaymentMethod` enum
(CASH, BANK_TRANSFER, CARD, EWALLET, GATEWAY, OTHER).

### Assets & facilities
`Asset`, `AssetMaintenance`, `Facility`, `FacilityBooking`

### Extracurricular & achievements
`Extracurricular`, `ExtracurricularMember`, `Achievement`

### Counseling & discipline
`CounselingRecord`, `DisciplineRecord`

`CounselingRecord.confidential` defaults to `true` (high-sensitivity:
counselor + authorized roles only).

### Documents & files
`FileObject`, `Document`

`FileObject` is storage metadata only (opaque `key @unique`, `provider`,
`bucket`, `mimeType`, `size`, `checksum`); the DB never holds file bytes. Access
is mediated by expiring URLs (StorageProvider abstraction, ADR-0006).

### Communication
`Announcement`, `ClassAnnouncementLink`, `AnnouncementAcknowledgment`,
`Notification`, `MessageThread`, `MessageParticipant`, `Message`

### AI
`AIConversation`, `AIMessage`, `AIToolCall`, `AIUsage`

The AI never gets a DB connection; each tool runs as the calling actor and every
tool call / token is recorded (ADR-0005).

### Integrations
`ApiKey`, `Webhook`, `WebhookDelivery`, `BackgroundJob`

### System
`AuditLog`, `SystemSetting`, `CustomField`, `CustomFieldValue`,
`DataRetentionPolicy`

- `AuditLog` is append-only by convention (no update/delete path in the app). It
  records `action`, `resource`, `resourceId`, `before/after Json`, actor info and
  request metadata, and is indexed on `(tenantId, createdAt)`,
  `(resource, resourceId)`, `(actorUserId, createdAt)`, `(action)`.
  `recordAudit()` deep-redacts `passwordHash, password, mfaSecret, tokenHash,
  apiKeyHash, secret` and is log-and-continue (audit never breaks a business op).
- `CustomField` is `@@unique([tenantId, entity, key])` with
  `CustomFieldValue` `@@unique([customFieldId, entityId])`.

---

## 7. Enums (all 50)

```
TenantType              TenantStatus            UserStatus
MembershipStatus        AcademicYearStatus      TermType
RoomType                EnrollmentStatus        StudentStatus
EmploymentType          StaffStatus             AttendanceSessionStatus
AttendanceStatus        AttendanceMethod        HolidayType
SubmissionStatus        AssessmentType          GradeStatus
ReportCardStatus        MaterialType            ExamStatus
PublishStatus           CmsBlockType            PostType
AdmissionPeriodStatus   ApplicationFieldType    ApplicationStatus
AdmissionDecisionType   LibraryItemType         LibraryCopyStatus
LoanStatus              ReservationStatus       InvoiceStatus
PaymentMethod           PaymentStatus           AssetCondition
BookingStatus           AchievementLevel        CounselingType
CounselingStatus        DisciplineSeverity      DisciplineStatus
DocumentAccess          AnnouncementPriority    AnnouncementAudience
NotificationChannel     NotificationStatus      MessageThreadType
WebhookDeliveryStatus   JobStatus
```

---

## 8. Seed data

`prisma/seed.ts` (run with `tsx`, configured as the Prisma seed). It is
**idempotent** (upserts throughout) and creates a clearly-synthetic demo school.
Never run it against production.

- Demo tenant slug `demo-school` ("Demo International School"), timezone
  `Asia/Jakarta`, currency `IDR`.
- Passwords come from `SEED_PASSWORD` (default `DemoPass123!`), hashed with
  bcrypt (work factor 12).
- It first syncs the permission catalog and materialises **platform roles**,
  then creates the tenant and calls `materialiseTenantRoles(tenantId)`.
- Staff users: `superadmin@`, `principal@`, `admin@`, `academic@`,
  `admissions@`, `finance@`, `librarian@`, `counselor@` (all `@demo.local`).
- 4 teachers (T-001…T-004), 8 students (S-0001…S-0008) each with a parent user
  (`parent01…08@demo.local`) and a `Guardian` linked via `StudentGuardian`, all
  enrolled into a classroom for academic year `2026/2027`.
- Academic structure: 1 year + Term 1, 3 grade levels (Grade 10–12), 4 subjects
  (MATH, ENG, SCI, HIST), 3 classrooms.
- One published announcement and one published event.

Verified live counts after seeding: 1 tenant, 28 users, 8 students.

### Sign-in accounts printed by the seed

| Role | Email |
|---|---|
| Platform admin | `superadmin@demo.local` |
| Principal | `principal@demo.local` |
| School admin | `admin@demo.local` |
| Teacher | `teacher.math@demo.local` |
| Student | `student01@demo.local` |
| Parent | `parent01@demo.local` |

---

## 9. Adding a schema change (the working recipe)

1. Edit `prisma/schema.prisma` (follow the naming/index conventions above; add
   `tenantId` to any new tenant-scoped model and index `(tenantId, …)`).
2. `npm run db:migrate` → creates a new timestamped migration and regenerates
   the client. Give it a descriptive name.
3. `npm run db:generate` if you only changed the client.
4. Update the consuming service in `src/server/services/` (with an
   `authorize(...)` + `requireTenantId(...)` preamble).
5. Commit the schema **and** the generated `migration.sql`.
6. Update this document's counts/notes if you add models or enums.

---

## 10. Known caveats

- **No RLS.** Tenant isolation is application-level only. A raw `prisma` query
  that forgets `tenantId` is a data-leak risk; use the `tenant.ts` helpers.
- **`package.json#prisma` is deprecated** (Prisma 7); migrate to
  `prisma.config.ts`.
- **`PasswordResetToken` migration is separate** from `init`; a fresh
  `migrate deploy` applies both in order.
- **Counts drift.** `PROJECT_STATE.md` still says "single migration / 97 tables".
  Trust `prisma/schema.prisma`, `prisma/migrations/`, and this document.
- **Deleting a `Tenant` cascades** through most relations (`onDelete: Cascade`);
  many cross-references to people/files use `SetNull` instead, so audit and
  file metadata survive.
- **Soft delete vs. hard delete.** Soft-deleted rows (`deletedAt != null`) must
  be filtered in `where` clauses; the services do this (`deletedAt: null`).
