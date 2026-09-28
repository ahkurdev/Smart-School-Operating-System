# PPDB — Online Admissions

A mobile-first admissions portal. Applicants should never feel they are using an
enterprise dashboard — the flow is short and plain.

## Applicant journey

```
Landing → Create account → Verify email → Choose admission period →
Fill application → Requirements → Upload documents → Review → Submit →
Application tracker → (Verification → Test/Interview → Decision) →
Re-registration → Become a student
```

## Features

- **Admission periods** with open/close dates, quota and tracks.
- **Eligibility rules** evaluated per track.
- **Dynamic forms** — admins build fields (short/long text, number, email,
  phone, date, select, multi-select, checkbox, radio, file, image, address,
  guardian, previous school, custom) with **conditional logic**.
- **Document requirements** — per period, verified on upload.
- **Optional registration fee.**
- **Applicant portal** — save progress, resume, track status.
- **Admin verification** — review each application & document.
- **Scoring / ranking** — when the institution uses it.
- **Interview / test** scheduling.
- **Decision** — accept / reject / waitlist, with acceptance letter.
- **Re-registration.**

## Document handling

Applicants upload identity, family, certificate, transcript, photo,
recommendation and custom documents. Every upload is MIME-verified, size-limited,
routed through a virus-scan hook, stored via the storage abstraction, and served
through signed/authorised URLs. Metadata and access are audited.

## Applicant → student conversion

Accepting and re-registering an applicant can **convert** them into a `Student`
with no re-typing: profile, guardians, documents, contact, previous school and
custom fields transfer. The conversion runs in a **single transaction** so a
partial student is never created. See `src/server/services/admission.service.ts`.

## Security

- Applicants may only read/write their **own** application.
- Admins are scoped to their tenant and to `admission.*` permissions.
- Uploaded documents inherit the same tenant + permission checks as everything
  else.

## Tested (`npm run test:admissions`)

Period creation, application submission, document upload, verification,
acceptance and the transactional conversion into a student.
