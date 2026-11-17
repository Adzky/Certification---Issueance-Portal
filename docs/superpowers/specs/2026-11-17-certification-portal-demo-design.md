# JMU Sertifikasi — Certification & Issuance Portal (Client Demo)

Date: 2026-11-17
Status: Approved 2026-11-17

## 1. Intent

Build a working demo of the **JMU Sertifikasi Certification & Issuance Portal** to win
**client approval of the concept**. The client will **clone the repo and run it themselves**,
then walk one document through the whole issuance chain by switching between demo users.

The demo must look like the reference images (`docs/reference/2.png`–`9.png`) and behave
like a real product along the main journey. It must be built so it can grow into production
without being thrown away: real database, real role/permission rules, real workflow state.

## 2. Goals

1. **Clone-and-run in one step.** `npm install` then `npm run dev` gives a working app with
   seeded data. No Docker, no external database, no accounts or API keys.
2. **Live end-to-end journey** (the core of the demo):
   Issuance Officer creates/prepares → Document Verifier verifies (or returns for revision)
   → Authorised Signatory signs (or rejects) → certificate is **Issued** with a number,
   validity dates and a public verification page. Issuance Manager sees it all on the
   dashboard and SLA queue. State persists across role switches and restarts.
3. **Faithful look** to the reference images: dark navy sidebar, blue primary, stat cards,
   filterable tables with a right-hand detail panel, status pills, workflow stepper.
4. **Production-ready shape:** clean separation between UI, a documented REST API, and a
   domain/service layer holding workflow and permission rules.
5. **Backend replaceable.** Production devs may use JS/TS, Python or Go. The UI talks to the
   backend **only through the REST API** so the backend can be rewritten without UI changes.

## 3. Non-goals

- Real authentication (passwords, SSO, MFA). Demo uses a "pick a demo user" login.
- Real digital signatures (PKI). Signing is a recorded workflow action with a drawn/stock
  signature image on the certificate.
- Pricing & billing, invoicing, email/notification delivery, integrations.
- Full implementation of every Settings card (18) or every sidebar page.
- Multi-tenancy, i18n switching, mobile-first layout (desktop-first; must not break on a laptop).
- Production deployment, CI/CD.

## 4. Anti-goals (would be a failure even if it "works")

- Setup that fails on the client's machine (native build steps, Docker, env vars to fill in).
- A clickable shell where buttons do nothing on the main journey.
- Business rules scattered in React components or Next.js-specific mechanisms
  (server actions) so the backend can't be lifted out.
- Visual style drifting far from the reference images.

## 5. Constraints

- Runs on Windows, macOS and Linux with Node.js LTS (20+).
- SQLite file database for the demo; schema must be Postgres-compatible (switch by
  changing the Prisma datasource + `DATABASE_URL`).
- Avoid dependencies needing native compilation where possible (Prisma ships prebuilt engines;
  acceptable).
- UI language: **English** (matches most image text). Indonesian sample data (company names
  like "PT Surya Kencana Industri") kept as in the images.

## 6. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | **Next.js (TypeScript) full-stack + Prisma + SQLite** (Postgres later) | Simplest clone-and-run, one project. Backend lives inside Next.js until split out. | **Chosen** — smoothest first run for a self-serve client; service layer + REST API keep the backend liftable. |
| B | React (Vite) + NestJS API + Postgres via Docker Compose | Cleanest split, but client needs Docker and two apps — most likely self-serve failure point; more build time. | Rejected |
| C | Monorepo: Next.js frontend + separate Fastify API, shared types | Real API boundary from day one, but two processes and more up-front work for a split A can do later. | Rejected |

## 7. Architecture (decided)

```
app/                    Next.js App Router pages (UI only)
  (auth)/login          Demo user picker
  (onboarding)/...      Role selection → requirements → registration → access
  (portal)/...          Sidebar layout: dashboard, requests, drafts, verification, signing,
                        issued certificates, settings, audit trail
  verify/[certNo]       Public certificate verification page (no login)
  api/...               REST route handlers — thin: parse/validate → call service → JSON
src/domain/             Pure TypeScript: entities, status enums, workflow state machine,
                        permission matrix. No Next.js, no Prisma imports.
src/services/           Use cases (createRequest, submitDraft, verify, returnForRevision,
                        sign, issue, …). Use repositories + domain rules; write audit log.
src/repositories/       Prisma data access.
src/api-client/         Typed fetch client the UI uses for every call to /api.
prisma/schema.prisma    Data model; prisma/seed.ts seeds demo users and sample data.
docs/api/openapi.yaml   The REST contract — the hand-off point for a Python/Go backend.
```

Rules:
- UI components never import from `services`, `repositories` or Prisma. Data fetching goes
  through `api-client` (client-side via a data-fetching library such as TanStack Query).
- Every state change goes through a service that (1) checks the actor's role permission,
  (2) checks the workflow transition is allowed, (3) writes an audit-log entry.
- Validation schemas (Zod) shared between API handlers and forms; the OpenAPI doc is kept
  in sync with them.

Suggested libraries (builder may substitute equivalents): Tailwind CSS + shadcn/ui,
lucide-react icons, Recharts for dashboard charts, TanStack Query + TanStack Table,
Zod, iron-session (or signed cookie) for the demo session, @react-pdf/renderer or a
print-styled HTML page for certificate download.

## 8. Roles and demo users (seeded)

| Role | Demo user | Main screens |
|---|---|---|
| Issuance Officer | Andi Pratama | Dashboard, Issuance Requests, Draft Documents, Issued Certificates |
| Document Verifier | Dewi Lestari | Dashboard, Verification Queue, Returned Documents |
| Authorised Signatory | Budi Santoso* | Dashboard, Signing Queue, Signed Documents |
| Issuance Manager | Rina Wulandari | Dashboard (KPIs, trend chart, status donut, SLA), all lists read-only, approves registrations |
| System Administrator | Fajar Hidayat | Dashboard, User & Role Management, Settings hub |

\*Image 2 swaps Andi Pratama and Budi Santoso between Officer and Signatory; images 3–9
consistently make Andi the Issuance Officer, so that wins and Budi becomes the Signatory.

Login screen = the "Pilih Role" screen (image 2, top-left): pick a role card → if exactly one
Active user holds that role, log in as them; if several do (e.g. after an onboarding approval),
show a small user picker for that role. A session = (user, active role). One user may hold
several RoleAssignments; **Switch Role** returns to the picker and may change user or role.
*(Builder-check call.)* The header shows
the current role pill, user name and a notification bell (count of items waiting on this role).

Permissions live in one matrix in `src/domain/permissions.ts` (role × action). The Certification
Decision Maker role appears in images 4 and 6; it is shown as "Not Assigned" / informational
only — no screens.

## 9. The live journey (must fully work)

Workflow state machine for an **Issuance Request** and its **Document**:

```
Request:  Submitted → In Preparation → In Verification → Ready for Signing → Issued
                          ↑                 │                   │
                          └─ Revision Required (verifier return)│
                          ↑                                     │
                          └──── new draft ◄── Document Rejected ◄┘ (signatory reject)
```

- **Verifier return** → document status *Revision*, request *Revision Required*; Officer edits
  the same draft, version bumps (v1.0 → v1.1), resubmits to verification.
- **Signatory reject** (reason required) → that document is closed as **Rejected** (terminal,
  counted in the "Rejected"/"Ditolak" cards of images 8 and 2). The request goes back to
  *In Preparation* and the Officer must create a **new draft** (new draft number, v1.0), which
  then goes through verification again. *(Owner decision.)*

**Who may act (owner decision):** an action is allowed only if the user (1) holds the role the
action needs, (2) that RoleAssignment is **Active** — or **Restricted**, limited to its remaining
scopes — and not Suspended/Revoked/Expired, and (3) the request's service scope is in the
assignment's authorised scopes. Queues are shared by everyone who passes these checks (no
per-user assignment required, except that the Officer who prepares is recorded as assignee).
Queues only list items the current user is allowed to act on.

Steps the client performs:
1. **Issuance Officer** clicks *Create Issuance Request* (client, service scope, object/scope,
   priority) → request is *Submitted*, then *Prepare Document* creates a Draft from a template
   (Certificate or Inspection Report) → edits fields → *Send to Verification*.
2. **Document Verifier** opens Verification Queue → reviews draft with a checklist
   (completeness/consistency items) → *Approve* (→ Ready for Signing) or *Return for revision*
   with a comment (→ Revision Required, back to Officer, version bumps v1.0 → v1.1).
3. **Authorised Signatory** opens Signing Queue → reviews preview → *Sign* (→ Issued) or
   *Reject* with reason (document → Rejected, request back to In Preparation for a new draft).
4. On signing, the system issues the **Certificate**: number per pattern
   (e.g. `JMU-QMS-2024-0087`: prefix + scheme code + year + sequence), issue date, valid-until
   (from service scope default term, e.g. 3 years for management-system certification, 1 year
   for inspection), status *Active*, verification URL.
5. **Issued Certificates** list shows it; detail panel shows preview with QR code linking to
   `/verify/[certNo]`; *Download* gives a PDF (or print view).
6. **Issuance Manager** dashboard counts, trend chart, status donut and priority/SLA queue reflect
   the change.
7. **Audit Trail** shows every step with actor, role, timestamp, action and comment.

Each list has: stat cards, search, filters (scope, status, priority/type, date range), sortable
paginated table, row selection opening the right detail panel with tabs (Overview, Documents,
Workflow, History), as in images 5, 8, 9.

Certificate lifecycle actions available to the Issuance Manager on an issued certificate:
Suspend, Reinstate, Revoke (with reason). Expiring/Expired are derived from dates.

**Calls made after the builder check** (owner may override):
- **One request → one live document at a time → one issued record** (rejected drafts stay
  attached to the request as history). A signed Inspection Report is also
  stored as a `Certificate` record (type = report) with the same lifecycle; numbering uses the
  `JMU-<SCHEME>-<YEAR>-<SEQ>` pattern for both. The draft-preview number is the draft number.
- **SLA:** request `dueDate` = created date + term by priority (High 3 days, Normal 7, Low 14
  working days, configurable in seed). "SLA achieved" = issued on or before `dueDate`.
  "Due soon" = due within 7 days. Every status transition is timestamped (via AuditLog) so
  per-stage SLA can be added later.
- **In Renewal** appears only as seeded status data (no renewal workflow). **Register Issued
  Certificate** and the Officer's **Request Revision** (ask the client for changes) are
  stubbed buttons that show a "full release" notice.

## 10. Onboarding / authorisation flow (images 3, 4, 6)

A **new demo user** path: from the login screen, *Register for a role* →
1. Select Role, 2. Role Review & Requirements (static content per role from images),
3. Register & Authorisation (personal info, employment, service scope, 7 control-document
uploads stored on local disk under `storage/`, declaration), *Submit for Authorisation*,
4. Access to Dashboard (shows status).

Registration creates a new user, or adds a new RoleAssignment if the email matches an existing
user *(builder-check call)*. The registration lands in a pending state; the **Issuance Manager** (authorising official)
approves or rejects it from a "Pending Authorisations" list; on approval the user's status
becomes **Active** and they can log in with that role. Statuses: Active, Restricted, Suspended,
Revoked, Expired (as defined in image 6). This is the secondary journey — fully working, but
lower polish priority than §9.

## 11. Scope of screens

**Fully built:** Login/role picker, onboarding (4 steps), all five role dashboards, Issuance
Requests, Draft Documents (with editor + preview), Verification Queue (+ checklist), Signing
Queue, Issued Certificates (+ lifecycle actions), Pending Authorisations, Audit Trail,
User & Role Management (list, change status/role), public Verify page, Settings hub (image 7)
as a grid of cards.

**Stubbed** (page exists in nav, shows a styled "Available in full release" panel with a short
description): Templates editor, Certificate Registry, Validity & Lifecycle (beyond the list
actions), Reports & Analytics, Approved Inspection Results, individual Settings sections other
than User Management and Roles & Permissions (read-only matrix view).

## 12. Data model (outline)

User (name, employeeId, email, phone, avatar, unit, roles via RoleAssignment)
RoleAssignment (user, role, serviceScopes, status, authorisedFrom/Until, authorisedBy)
RegistrationApplication (+ ControlDocument uploads, declaration)
Client (organisation)
ServiceScope (code, name, scheme/standard, default validity term, cert number prefix)
IssuanceRequest (number REQ-YYYY-NNNN, client, scope, object, priority, status, assignee,
  dueDate for SLA, timestamps)
Document (draft number DRF-YYYY-NNNN, request, type, version, status, field data JSON)
DocumentVersion / VerificationResult (checklist answers, comment)
Signature (signer, signedAt)
Certificate (number, request, document, issue/valid-until dates, status, verification token)
AuditLog (actor, role, action, entityType, entityId, comment, at)
Notification (recipient role/user, message, read)
NumberSequence (key, next value) — for all numbering, transactional.

## 13. Seed data

Enough to make dashboards look like the images on first run: ~120 requests across statuses
over the last ~60 days (relative to the run date, not fixed Oct 2024), ~40 drafts, ~450 issued
certificates across statuses, the clients and scopes shown in the images, a realistic audit log.
`npm run db:reset` restores the seeded state so the client can replay the demo.

## 14. Quality bar

- Domain layer (state machine, permissions, numbering, validity calculation) has unit tests.
- One end-to-end test (Playwright) runs the full §9 journey.
- README: requirements (Node 20+), two commands to run, the demo walkthrough script
  (which role to pick, what to click), how to switch to Postgres, and where the API contract is.

## 15. Left to the builder

- Exact component library choices within the suggestions above.
- Exact visual details, icons and chart styling, as long as they match the images' look.
- Draft document field sets per template (derive from the certificate/report previews).
- Verification checklist items (sensible defaults from image 6's descriptions).
- Exact seed volumes and names.
