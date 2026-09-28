# Dynamic QR Attendance

Students carry a **digital identity card** whose QR code changes roughly every
**30 seconds**. The QR contains an **opaque, signed, rotating token** — never raw
personal data (no name, photo, NISN or address).

## Why rotating + signed

A static QR (or one carrying raw PII) can be photographed, shared and replayed.
A short-lived signed token makes a screenshot useless within seconds and lets the
server prove the code was issued by it for a specific student and tenant.

## Token contents (logical)

```
token version · student reference · issuedAt · expiresAt · nonce · tenant ref · signature
```

Signed with `ATTENDANCE_SIGNING_KEY`; verified server-side. The payload is
opaque to the client.

## End-to-end flow

```
Student client           Server                         Teacher scanner
──────────────           ──────                         ───────────────
request token  ───────▶  verify user/student/tenant/
                         enrollment/session eligibility
              ◀───────   issue short-lived signed token
render QR (no reload)

                         ◀──── teacher scans token
                         verify signature, expiry, nonce,
                         student, tenant, session,
                         teacher permission
                                                       ◀──── identity card shown
                                                        (photo, name, ID, class)
                                                       ◀──── teacher confirms
                         create attendance record
                         consume nonce
                         write audit log
```

## Server flow details

1. `Student requests attendance token` — server verifies the user, that they are
   an enrolled student, the tenant, and that an attendance session is open.
2. `Server issues short-lived signed token` — TTL from
   `ATTENDANCE_TOKEN_TTL_SECONDS` (default 30s), clock tolerance from
   `ATTENDANCE_CLOCK_TOLERANCE_SECONDS`.
3. `Student client renders QR` — refresh **without a page reload**; if offline,
   the UI states the code cannot be verified until connectivity returns (no fake
   offline verification).
4. `Teacher scanner reads token` → server verifies signature, expiry, nonce,
   student, tenant, session, and teacher permission.
5. `Teacher sees identity confirmation card` (photo, name, student ID, class).
6. `Teacher confirms` → attendance transaction created, nonce consumed, audit
   recorded.

## Security properties

- **Expiration**: stale screenshots fail.
- **Nonce**: single-use; replay rejected.
- **Replay protection**: one attendance per session per student.
- **Tenant validation**: a token from school A is invalid at school B.
- **Teacher authorization**: only authorised staff may open a session or scan.
- **Enrollment validation**: only currently-enrolled students can generate codes.
- **Clock tolerance**: small skew tolerated; **server time is authoritative**
  (never the browser clock).
- **Manual fallback**: when a device is dead or inaccessible, a teacher may mark
  attendance manually — requiring actor, reason, timestamp, old/new value, and an
  audit entry.

Optional (non-essential) enhancements: geofence, school Wi-Fi check, BLE beacon.
These are never required for the core flow.

## Tested (`npm run test:qr`)

Valid · expired · tampered · replayed · wrong-tenant · wrong-session · closed
session · unauthorised teacher · duplicate scan · manual override.
