# Contributing

Thanks for helping improve the Smart School Operating System.

## Getting set up

See the [README](./README.md) quick start. In short: `npm install`, copy
`.env.example` → `.env`, `bash scripts/pg.sh start`, `npm run db:deploy`,
`npm run db:seed`, `npm run dev`.

## Before you push

Run the full gate:

```bash
npm run verify      # typecheck + lint + all tests
npm run build       # production build must succeed
```

A change is only done when typecheck, lint and the relevant tests pass.

## Principles

- **Vertical slices.** A feature spans database → service → permissions → UI →
  test. Avoid large static mockups that never become functional.
- **No fake implementations.** A "completed" feature must work end to end. No
  TODO-only buttons, placeholder data or `console.log` standing in for logic.
- **Server-side authorization.** Never trust the client. Every service and
  server action calls `authorize(actor, permission)` and scopes by
  `requireTenantId(actor)`.
- **Tenant isolation is sacred.** Every tenant-scoped query filters by tenant;
  add an isolation test when you touch one.
- **Strict TypeScript.** No `any` without a documented reason; no `@ts-ignore`
  to hide bugs.
- **Migrations, not manual SQL.** Schema changes go through
  `npm run db:migrate` and are reviewed for destructive operations.
- **Dependencies, sparingly.** Before adding one, check whether the platform
  already provides it, whether it is maintained, and its bundle cost. Don't
  install a library for a trivial function.
- **Accessibility (WCAG 2.2 AA).** Keyboard reachable, visible focus, labelled
  controls, correct semantics, and states for loading/empty/error/disabled.
- **Design follows [DESIGN.md](./DESIGN.md)** together with Anti-Slop. Motion is
  purposeful, never decoration for a dashboard.

## Commits

Conventional commits: `feat:`, `fix:`, `refactor:`, `perf:`, `security:`,
`docs:`, `test:`, `chore:`, `build:`, `ci:`.

## Code structure

Organise by domain under `src/features/<domain>` and `src/server/services`.
Keep business logic in services, not in components. See
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Tests

Add tests for anything security-relevant (authorization, tenant isolation, QR,
admissions, conversion, retention). The suite lives in `scripts/*-test.ts` and is
wired into `npm run verify`. Prefer proving the *negative* (a blocked access)
as well as the positive.

## Reporting security issues

See [SECURITY.md](./SECURITY.md) — report privately, do not file a public issue.
