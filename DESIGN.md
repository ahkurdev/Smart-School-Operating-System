# Design Direction

This is the design source of truth for Smart School OS. Anti-Slop (`anti-slop/`) is the
filter; this file is the direction. Every choice below has a one-line reason (R-31).

## Product personality

A serious institutional tool that still feels human. It runs a school's whole day:
attendance, grades, admissions, money. It should read as **calm competence**, the way a
well-run school office feels: organised, legible, unhurried. Not a startup landing page,
not a generic admin theme.

Two faces, one system:

- **Public face** (school website, PPDB): warm, editorial, trustworthy. School content
  is the hero; UI recedes.
- **Working face** (portals, dashboards): information-dense, fast, keyboard-first,
  predictable. The user is a busy teacher or admin doing a task.

## Design Read

> Reading this as: an education operations platform for school staff, families, and
> students, in a grounded institutional language, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.

- **ENERGY 2:** confident, not loud. Public pages can open with a real photograph and a
  strong headline; admin pages stay quiet.
- **RHYTHM 2:** consistent structure with deliberate breaks. Dashboards share a grid;
  the public site varies section composition.
- **MOTION 1:** hover and focus states, plus a single purposeful scroll-reveal on the
  public home. No endless loops, no decoration that moves. Motion is scarce because the
  work is repetitive and must feel instant.

## Identity motif

**The ruled column.** A faint 1px vertical rule and a left-aligned label column recur in
section headers, forms, and detail views: the visual grammar of a well-kept register
book. It is subtle, structural, and specific to a school (registers, timetables,
rolls). It is never a decorative colored stripe (R-01): it carries the label/field
relationship.

## Color

Roles, not vibes. One confident core, one ink neutral, one accent.

| Role | Light | Dark | Reason |
|---|---|---|---|
| Ink (foreground) | near-black slate | warm off-white | long reading sessions in staff tooling need high legibility |
| Paper (background) | warm grey-white, not pure white | deep slate, not pure black | pure white/black is harsh for all-day use; slight warmth reads paper-like |
| Core / Primary | deep teal-green `#0f766e` family | lifted teal | teal is calm and institutional, reads as "school" without the default blue; distinct from the AI-default blue-purple (R-01) |
| Accent | warm amber | warm amber | marks the single most important action per screen (e.g. Confirm attendance, Submit application); amber against teal is a deliberate complementary accent (R-29) |
| Status | success green, warning amber, danger red, info blue-grey | same, tuned | functional status only; never decorative |

Palette cap: 2 core roles (ink + teal) + 1 accent (amber), plus functional status
colors. (R-29)

**Reason for teal over blue:** blue is the default institutional color and the default
AI color; teal keeps the trust and drops the sameness.

## Typography

- **Display / headings:** a humanist sans with a slightly condensed, editorial voice
  (e.g. "Fraunces" for the public site masthead, "Inter Tight" or "Public Sans" for the
  working UI). Reason: headings need character on the public site and neutrality in the
  app; newspaper-like mastheads read as "established institution".
- **Body / UI:** a legible workhorse sans with strong numerals (tabular figures for
  tables, grades, times). Reason: dashboards are number-heavy; digits must align.
- **Mono:** only for genuinely monospace data: student IDs, QR tokens in debug, API
  keys. Reason: mono is functional here, never an aesthetic (R-06).

Numbers in tables, grades, and times use `font-variant-numeric: tabular-nums`.

## Spacing & layout

- 4px base scale. Admin density: 8-16px inner spacing, 24-32px section gaps.
- Public site uses a wider rhythm: 64-96px section padding desktop, halved on mobile.
- Container widths: public 1200px, admin fluid with a 240px rail.

## Radius, borders, shadow, surfaces

- Radius: `6px` for controls, `10px` for panels. Small and consistent. Not pill-shaped
  (R-11).
- Borders: 1px hairline in a low-contrast neutral. Structure comes from borders and
  spacing, not from shadows (R-12).
- Shadow: used only to mark true elevation: dropdown, popover, dialog, the one floating
  scan sheet. Everything else is flat.
- Surfaces: three levels (`sunken`, `base`, `raised`). Admin dense views lean on
  `sunken` panes inside `base` page; raised is reserved for overlays.

## Icons

A single, restrained outline set (lucide) chosen deliberately because the school domain
(calendar, book, users, clipboard, wallet) maps cleanly onto it. Icon relevance is
written down where a glyph is generic (R-04). No decorative sparkles, orbs, or "AI"
glyphs anywhere.

## Motion

- Public home: a small number of purposeful reveals (hero fades in, stats count up once
  when scrolled into view). Reason: orient the reader, no looping.
- App: hover/focus transitions only (150ms). No entrance animations in tables or forms.
- All motion respects `prefers-reduced-motion`.

## Public site direction

- Editorial: real photographs (school building, classrooms, activities), generous
  whitespace, a strong masthead, clear section hierarchy.
- No fake stats, no fake testimonials, no logo bar, no "trusted by" (R-17, R-18, R-36).
  Numbers only when seeded and clearly labelled as sample data in the demo, or omitted.
- Nav reflects only pages that exist (R-24).

## Admin direction

- The screen's job decides the layout, not a template. A students list leads with the
  columns a registrar scans (name, ID, class, status). An attendance screen leads with
  today's session state. (C-3)
- Sidebar grouped by domain (People, Academic, Admissions, Communication, Content,
  Operations, Intelligence, System), permission-filtered. Never a flat list of 40 items.
- Command palette (`Cmd/Ctrl+K`) is the power-user path.
- Every table has search, sort, pagination, and honest empty/loading/error states (R-27).

## PPDB direction

Mobile-first because applicants apply from phones. Linear, reassuring, one decision per
screen. Large tap targets, clear progress, plain language. Not an enterprise dashboard.

## Motion & animation library policy

ReactBits-style effect components are used only on the public site and onboarding, and
only where they serve orientation (status: `src/components/shared/motion/`). Admin
screens do not use them.

## Empty / loading / error states

Every data view ships all three, each naming the cause and the next action (R-27):
- Empty: "No students yet. Add a student or import a CSV." with the action button.
- Loading: skeleton rows sized to the real layout, not a spinner alone.
- Error: what failed and a retry.

## Imagery

Real photos or none. Avatars are initial-based placeholders until a real photo is
uploaded. No generic 3D blobs, no undraw/sketchset (R-22).

## Forbidden patterns (this project's explicit no-list)

- Blue-purple / blue-cyan gradients as a core treatment (R-01)
- Glassmorphism on nav + cards + modals together (R-10)
- Pill-shaped everything (R-11)
- Glow on cards/buttons/badges at once (R-13)
- Decorative status dots, endless pulses (R-19)
- Em dashes in copy (R-02)
- Emoji as UI decoration
- Fake statistics, testimonials, logo bars, "trusted by" (R-17, R-18, R-36)
- Dead nav links and dead controls (R-24, R-26)
- Monospace headings, HOW-IT-WORKS wide-tracked uppercase (R-06)
- Cloning Linear/Vercel/Stripe/Notion (R-30)

## Design tokens

Tokens live in `src/styles/globals.css` as CSS custom properties, consumed by Tailwind
(`tailwind.config.ts`). Light and dark are both first-class and both verified (R-34).
