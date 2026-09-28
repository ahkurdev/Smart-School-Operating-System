# Security

This document is the living security reference for the Smart School Operating
System: the threat model, the controls in place, and the operating procedures.

## Reporting

Report vulnerabilities privately to the maintainers. Do not open a public issue
for a suspected vulnerability.

## Assets to protect

1. **Student personal data** (profiles, guardians, medical/special-education
   notes, disciplinary & counseling records) — the most sensitive class.
2. **Authentication material** — session tokens, API keys, MFA secrets.
3. **Academic records** — grades, report cards, attendance.
4. **Financial data** — invoices, payments.
5. **Cross-tenant integrity** — one school must never see another's data.

## Threat model (abbreviated)

| Threat | Vector | Control |
| --- | --- | --- |
| Cross-tenant data access | Missing/incorrect `tenantId` scope | Every service scopes by `requireTenantId(actor)`; tests assert isolation |
| Privilege escalation | Forged role/permission in the client | All authorization is server-side (`authorize()`); the client is never trusted |
| QR attendance fraud | Screenshot/replay of a static code | Short-lived signed tokens (~30s), nonce, replay protection, teacher confirmation |
| IDOR | Guessing another record's id | Service-level ownership + tenant checks, not just UI filtering |
| Credential stuffing / brute force | Automated login attempts | Rate limiting, lockout, login history, suspicious-login detection |
| Secret leakage | Keys in the repo or logs | Env-only secrets; `.env` git-ignored; `.env.example` uses placeholders; logs redact secrets |
| Prompt injection (AI) | Malicious content steering the assistant | Tool allowlist, permission-aware tools, tool-call cap, output validation |
| Malicious upload | Disguised/oversized files | MIME + size validation, storage abstraction, signed/authorized access |
| XSS | Injected script via CMS/user content | React escaping, strict CSP, sanitised rich content |
| SSRF | Server fetching attacker URLs | Outbound URL allow-listing for webhooks (https only), no user-controlled fetch |

## Controls implemented

### Authentication
- Password hashing with a modern KDF; sessions are opaque, rotated tokens stored
  as hashes.
- Password reset & email verification flows; optional MFA/TOTP.
- Account lockout and per-identifier rate limiting.
- Login attempt history and suspicious-login flagging.

### Authorization
- RBAC with granular permissions (`student.read`, `grade.write`,
  `attendance.override`, `finance.manage`, `cms.publish`, ...).
- Policies centralised in `src/server/policies`; **every** service and server
  action calls `authorize(actor, permission)`.
- Tenant guard: services resolve the tenant from the actor, never from client
  input.

### Transport & headers
- Strict `Content-Security-Policy`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, and HSTS in production (see `next.config.ts`).
- Secure, httpOnly, sameSite cookies; session rotation on privilege change.

### Input & data
- Zod validation at every action/route boundary.
- Parameterised queries only (Prisma) — no string-built SQL.
- File uploads: MIME + size validation, stored via a provider abstraction,
  metadata in the DB, access via signed/authorized URLs.
- Sensitive exports are audited.

### Audit & monitoring
- Append-only `AuditLog` for meaningful mutations (actor, action, resource,
  tenant, timestamp, request metadata) with sensitive fields redacted.
- Structured logging with request ids; secrets never logged.

## QR attendance security

See [ATTENDANCE.md](./ATTENDANCE.md). The QR encodes an **opaque signed token**
— never raw PII. Tokens expire in ~30s, carry a nonce, are single-use, and are
verified server-side (signature, expiry, nonce, tenant, session, teacher
permission). Expired screenshots fail. Manual overrides require a reason and are
audited.

## Privacy

Student information is treated as sensitive personal data: least privilege,
data minimisation, field-level visibility, audited access, protected exports and
secure file handling. Public APIs never return full student records. Retention
is configurable per institution (`src/server/services/retention.service.ts`).

## OWASP Top 10 coverage

| Category | Status |
| --- | --- |
| A01 Broken Access Control | Centralised policies + tenant guard; isolation tests |
| A02 Cryptographic Failures | Hashed secrets, signed tokens, env-managed keys |
| A03 Injection | Prisma parameterisation; Zod validation |
| A04 Insecure Design | Threat model + policy layer + review gates |
| A05 Security Misconfiguration | Hardened headers, `poweredByHeader: false`, env config |
| A06 Vulnerable Components | Pinned deps; `npm audit` in CI |
| A07 Auth Failures | Rate limiting, lockout, MFA option, session rotation |
| A08 Data Integrity Failures | Signed webhooks; migration discipline |
| A09 Logging Failures | Audit trail + structured logs |
| A10 SSRF | Outbound URL allow-listing |
