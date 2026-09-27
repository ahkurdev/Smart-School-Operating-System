# Testing Reference

How testing works in the Smart School Operating System (SSOS) repository **as it
exists today**. This document is deliberately honest about the gap between the
test tooling that is configured and the tests that are actually written, because
that gap is a real risk in this build.

---

## 0. TL;DR — current reality

| Thing | State |
|---|---|
| Test runner config file (`vitest.config.*`) | **Does not exist** |
| E2E config file (`playwright.config.*`) | **Does not exist** |
| Test files (`*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`) | **None exist** |
| `vitest` installed | **Yes** (devDependency `^2.1.8`, binary in `node_modules/.bin`) |
| `@playwright/test` installed | **Yes** (devDependency `^1.49.1`, browser binaries in `node_modules/.bin`) |
| `npm test` (`vitest run`) | Runs, finds **0 test files**, exits **code 1** ("No test files found") |
| `npm run test:e2e` (`playwright test`) | Runs, finds **0 tests** ("Total: 0 tests in 0 files") |
| Automated tests written | **NONE — this is Phase 95 work, not yet started** |

Both `package.json` scripts and both devDependencies exist and the runners
execute, but **there is no suite behind them yet**. Any green-looking CI that
called `npm test` today would actually be a non-zero exit. Do not report this
project as "tested" in its current state.

The project's real verification so far has been **manual browser E2E** plus the
static checks below — not an automated suite.

---

## 1. What *is* in place

The tooling foundation is installed and ready; only the tests are missing.

- **Vitest** (`vitest`, `^2.1.8`) — intended unit/integration runner.
- **Playwright** (`@playwright/test`, `^1.49.1`) — intended browser E2E runner.
- `tsx` (`^4.19.2`) — used to run `prisma/seed.ts` and any future TS scripts.
- Package scripts (from `package.json`):

  ```json
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
  ```

- `tsconfig.json` uses strict mode with `noUncheckedIndexedAccess`,
  `noImplicitOverride`, and the `@/*` → `./src/*` path alias. New tests should
  import app code through the same `@/` alias so they exercise the real module
  graph.

Vitest's default include glob is `**/*.{test,spec}.?(c|m)[jt]s?(x)` and the
default excludes skip `node_modules`, `dist`, `.next`, and config files. Because
no config file exists, those defaults are what currently apply.

---

## 2. Static verification (this *does* run and is meaningful)

These are the checks the project has actually been validated with.

### Typecheck

```
npx tsc --noEmit      # or: npm run typecheck
```

> **BLOCKING — this currently FAILS.** As of this writing there are **2 real
> type errors**, both in `src/app/(app)/app/classes/[classId]/page.tsx`
> (lines 39 and 47):
>
> ```
> error TS2339: Property 'code' does not exist on type '{ name: string; id: string;
> academicYear: {...} | null; gradeLevel: {...} | null; stream: string | null;
> capacity: number; homeroomTeacher: {...} | null; }'
> ```
>
> Cause: `getClassRoster()` in `src/server/services/academic.service.ts`
> selects `klass` **without** the `code` column (its `select` at ~line 391 omits
> `code`), but the class-detail page reads `klass.code`. Fix by adding
> `code: true` to that `select`, or by not using `klass.code` in the page.
>
> `PROJECT_STATE.md` claims "typecheck clean" — that claim is **stale**. Any CI
> or pre-commit hook that runs `tsc --noEmit` will fail right now.

### Lint

```
npx eslint .          # or: npm run lint
```

Currently **passes** (0 problems) with `next/core-web-vitals` + `next/typescript`
and two added rules:

- `@typescript-eslint/no-explicit-any`: **error** (no `any` allowed).
- `@typescript-eslint/no-unused-vars`: **error**, with `^_` prefix escape hatch
  for args and vars.

### Production build

```
npm run build         # next build
```

Was reported green at the end of Phase 11 (`PROJECT_STATE.md`). Re-run it after
fixing the type error above, since `next build` also type-checks and will fail
on the same `klass.code` bug.

The `next.config.ts` build sets security headers, `reactStrictMode: true`,
`poweredByHeader: false`, and an 8 MB Server Action body limit — worth asserting
in an E2E smoke test later.

---

## 3. The manual E2E that has been performed

Recorded in `PROJECT_STATE.md` as the proof-of-function for Phases 1–11. The
approach: start the dev server against the seeded local database and drive it in
a real browser.

**Procedure that was followed:**

1. `bash scripts/pg.sh start` (port 5433), then `npm run db:seed` if needed.
2. `npm run dev` (Next.js on `http://localhost:3000`).
3. Sign in as `admin@demo.local` / `DemoPass123!`.
4. Verify: dashboard shows live counts; the sidebar is permission-filtered
   (a `school_admin` does **not** see Finance/Assets/Settings/Audit — proving
   RBAC is enforced, not just cosmetic); `/app/users` renders the seeded users
   with roles + status + search + pagination.
5. Assert **0 console errors**.

**Seed accounts for manual testing** (password `DemoPass123!` unless
`SEED_PASSWORD` overrides):

| Purpose | Email |
|---|---|
| Platform admin / super admin | `superadmin@demo.local` |
| Principal | `principal@demo.local` |
| School admin | `admin@demo.local` |
| Academic admin | `academic@demo.local` |
| Finance admin | `finance@demo.local` |
| Teacher | `teacher.math@demo.local` |
| Student | `student01@demo.local` |
| Parent | `parent01@demo.local` |

**Behaviour worth exercising manually today** (each maps to real code):

- **RBAC / permission filtering** — sign in as different roles and confirm the
  sidebar (`src/components/layout/nav-config.ts` + `filterNav`) and pages
  (`requirePageActor(permission)` in `src/server/auth/guards.ts`) change.
- **Tenant isolation / IDOR** — as one tenant's admin, request a record id from
  another tenant; expect a **404**, not a 403 (see `assertSameTenant` in
  `src/server/db/tenant.ts`).
- **Sensitive-field redaction** — as a role without `student.read_sensitive`
  (e.g. `teacher`), open a student detail page; medical/special-ed fields must
  be absent/null with `sensitiveRedacted: true`, never leaked.
- **Auth flows** — login lockout after repeated failures, password reset
  (dev logs the link to the console when `EMAIL_PROVIDER=console`), logout,
  tenant switching.
- **Account lifecycle** — create user with a generated password (returned once),
  reset a user's password (returns a temp password), deactivate a membership.

---

## 4. How to add automated tests (nothing exists yet)

There is currently **no** config, so the first person to write a test must also
add the runner config. Suggested layout that fits this repo:

```
vitest.config.ts                      # add this first
src/**/<name>.test.ts                 # unit tests next to source
tests/                                # integration tests (optional)
playwright.config.ts                  # add this for E2E
e2e/<name>.spec.ts                    # Playwright specs
```

### 4.1 Unit / integration (Vitest)

`vitest.config.ts` should:

- set the `@` path alias to `./src` (mirror `tsconfig.json`),
- set `environment: "node"` for pure server/service tests (React/testing-library
  would need `jsdom` plus `@testing-library/*`, **which are not installed**),
- keep the default `*.test.ts`/`*.spec.ts` include if that suits you.

Highest-value first unit tests, each against real, self-contained modules:

| Target | File | Why it is testable without a browser |
|---|---|---|
| Password policy | `src/server/auth/password.ts` — `passwordProblem` | Pure function; assert min length 10, max 200, no leading/trailing space, ≥2 character classes. |
| Password hashing | `hashPassword` / `verifyPassword` | bcrypt round-trip. |
| Rate limiter | `src/server/auth/rate-limit.ts` | Deterministic fixed-window counter; call `__resetRateLimits()` between tests. |
| Random / hash helpers | `src/server/auth/random.ts` — `sha256`, `randomToken`, `safeEqual` | Pure; assert length, constant-time compare length-mismatch false. |
| Session/attendance JWT+HMAC | `src/server/auth/signing.ts` | Needs `SESSION_SECRET` / `ATTENDANCE_SIGNING_KEY` set; assert `verifyAttendanceToken` rejects malformed, bad signature, and expired tokens, and that `signSessionJwt`/`verifySessionJwt` round-trip. |
| Permission catalog | `src/lib/permissions.ts` | `isPermission`, `permissionSubject`, uniqueness of `ALL_PERMISSIONS`. |
| RBAC seed expansion | `src/server/services/rbac.seed.ts` — `expandPermissions` | `"*"` expands to all; explicit lists filter to known permissions. |
| Typed errors | `src/server/errors.ts` | `Errors.*` map to correct HTTP status; `toErrorResponse` hides internals for non-`AppError`. |
| Zod env schema | `src/lib/env.ts` — `getEnv` | Assert it throws a readable multi-issue error on missing `DATABASE_URL`/secrets. |

Set required env vars in a Vitest `setupFiles` or `env` block, since several
modules (`signing.ts`, `env.ts`) validate them on first use.

### 4.2 Service tests (needs a database)

The service layer (`src/server/services/*.service.ts`) is where the real logic
and the tenant-isolation guarantees live, so it is the most valuable place to
test — but it hits Prisma. Recommended approach:

- Point `DATABASE_URL` at a **separate test database** (e.g. `smart_school_test`
  on the same local Postgres at port 5433).
- Run `npm run db:deploy` (or `prisma migrate deploy`) against it, then
  `npm run db:seed` (or a trimmed test fixture) in a global setup.
- Build an `Actor` directly (see `src/types/actor.ts`) with the permissions you
  want to test — you do not need a real HTTP session to call a service.
- **Clean up between tests**; many services have uniqueness constraints, and the
  seed is idempotent but shared.

Priority service assertions:

- **Tenant scoping is real**: an actor for tenant A calling a list/get for tenant
  B gets empty results or a 404 (`assertSameTenant` semantics), not data.
- **Permission gating**: calling a service without the required permission throws
  `AppError` with code `FORBIDDEN`.
- **Sensitive fields**: `getStudent` returns `sensitiveRedacted: true` and null
  medical/special-ed fields when the actor lacks `student.read_sensitive`, and
  the real values when the actor has it.
- **Write auditing**: a successful `createStudent`/`createUser`/`createClass`
  writes an `AuditLog` row with the expected `action` and `resource`.
- **Transactional provisioning**: `createUser` never leaves a user without a
  membership; `createTenant` + `materialiseTenantRoles` produce the default roles.

### 4.3 End-to-end (Playwright)

Add `playwright.config.ts` with `webServer` to boot `npm run dev` (or a built
`npm start`) against the seeded test database and `baseURL: http://localhost:3000`.
Browser binaries come from `@playwright/test`; run `npx playwright install` if
they are missing on a fresh machine.

Specs worth having first, matching the manual E2E above:

1. **Auth smoke** — login as `admin@demo.local`, land on `/app`, **assert 0
   console errors** (capture via `page.on("console")` / `page.on("pageerror")`).
2. **RBAC visibility** — as `admin@demo.local`, Finance/Assets/Settings/Audit are
   absent from the sidebar; as `superadmin@demo.local` they are present.
3. **Forbidden redirect** — a user without a permission hitting a gated page is
   redirected to `/app/forbidden`.
4. **Student sensitive redaction** — as a teacher role, sensitive notes are not
   rendered.
5. **Tenant isolation** — a cross-tenant record URL yields the not-found page.

---

## 5. Conventions and gotchas for tests

- **Alias**: import via `@/…`, never deep relative `../../`. Mirrors app imports
  and survives refactors.
- **No `any`**: ESLint fails the build on `any`; type test fixtures properly or
  use `unknown` + narrowing.
- **Unused vars**: prefix intentionally-unused bindings with `_` or ESLint fails.
- **`"use server"` files** (`src/features/**/actions.ts`) may only export async
  functions — you cannot export a constant from them, which complicates direct
  unit testing of action modules. Test the underlying **service** function
  instead of the Server Action wrapper wherever possible.
- **Env is validated on import.** `src/lib/env.ts` (`getEnv`) and
  `src/server/auth/signing.ts` read secrets lazily; set `DATABASE_URL`,
  `SESSION_SECRET`, `ATTENDANCE_SIGNING_KEY`, and `ENCRYPTION_KEY` (each ≥16
  chars) in the test environment before importing them.
- **Time-sensitive logic**: attendance-token expiry and dashboard "today"
  boundaries use `Date.now()`; use fake timers or a tolerant clock
  (`ATTENDANCE_CLOCK_TOLERANCE_SECONDS`, default 5) rather than real sleeps.
- **Rate limiter is in-memory**: call `__resetRateLimits()` between tests, or
  login tests will interfere.
- **Idempotent seed**: `prisma/seed.ts` can be re-run, but it shares one demo
  tenant. Prefer a dedicated, disposable test DB over the dev DB.
- **Windows dev host**: use `scripts/pg.sh` to manage Postgres (it works around
  the `0xC0000142` `pg_ctl` crash by launching `postgres.exe` directly).

---

## 6. What "done" should mean for Phase 95

Phase 95 in `ROADMAP.md` is "Comprehensive automated tests". When it is tackled,
the acceptance bar implied by this codebase is:

- `vitest.config.ts` and `playwright.config.ts` exist and are committed.
- `npm test` exits **0** with a non-empty suite (unit + service tests).
- `npm run test:e2e` exits **0** with at least the auth/RBAC smoke specs above.
- `npm run typecheck` and `npm run lint` are clean in CI.
- The suites run against a **dedicated test database**, never the dev/prod data.
- The verified guarantees from §3 and §4.2 (tenant isolation, permission gating,
  sensitive-field redaction, audit writes) are covered by assertions rather than
  manual clicks.

Until then, treat this repository as **manually verified only**, and treat
`npm test` / `npm run test:e2e` as **not yet meaningful** (they currently find
zero tests, and `vitest run` exits non-zero because of it).
