# JMU Certification & Issuance Portal Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clone-and-run Next.js demo of the JMU Sertifikasi portal where a client walks one request from creation through verification and signing to an issued, publicly verifiable certificate, switching between seeded role users.

**Architecture:** One Next.js (App Router, TypeScript) project. Pure domain rules in `src/domain` (no framework imports) → use-case services in `src/services` (permission + transition check + audit in one DB transaction) → Prisma repositories → REST route handlers under `app/api`. The UI only calls the backend through `src/api-client` over HTTP, so a Python or Go backend can replace `app/api` + `src/services` by implementing `docs/api/openapi.yaml`.

**Tech Stack:** Node 20+, Next.js (latest stable via `create-next-app`), React, TypeScript strict, Tailwind CSS + shadcn/ui, lucide-react, Recharts, TanStack Query + TanStack Table, Zod, Prisma + SQLite, iron-session, @react-pdf/renderer, qrcode, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-certification-portal-demo-design.md`

## Global Constraints

- Fresh clone → `npm install` → `npm run dev` must produce a working, seeded app. No Docker, no external DB, no env vars to fill in, no API keys.
- Must work on Windows, macOS, Linux with Node.js 20+, **including a checkout path containing spaces and `&`** (this repo lives in `Certification & Issueance Portal`). npm scripts call `node scripts/*.mjs` or plain binaries; no shell chaining tricks that break under cmd.exe.
- SQLite file DB (`prisma/dev.db`, gitignored). Schema stays Postgres-compatible: no SQLite-only SQL; enums stored as `String` and validated by Zod/domain types; JSON stored as `String`.
- UI components never import from `src/services`, `src/repositories`, `src/server` or `@prisma/client`. Enforced by an ESLint `no-restricted-imports` rule on `app/**/(components|pages)` and `src/components/**`.
- No Next.js server actions for data changes. Every mutation is a REST call to `app/api/**`.
- Every state change: (1) permission check, (2) workflow transition check, (3) AuditLog row — inside one Prisma transaction.
- UI language English; sample data keeps Indonesian company names (PT Surya Kencana Industri, PT Kaltim Daya Mandiri, PT Agrinas Palma Nusantara, PT Nammam Fashion Industries, PT ZXF Plastic, PT Sentral Lab Genetik, PT Adaro Indonesia, PT MBP).
- Visual style per `docs/reference/*.png`: navy sidebar (`#0B1F4D`-ish), primary blue (`#1D4ED8`-ish), white cards on `#F4F7FC` background, coloured status pills, stat cards with tinted icon tiles.
- Seeded dates are relative to the run date (no fixed Oct 2024 dates).
- Error JSON shape everywhere: `{ "error": { "code": ErrorCode, "message": string } }` with `FORBIDDEN`→403, `NOT_FOUND`→404, `VALIDATION`→400, `INVALID_TRANSITION`→409, `CONFLICT`→409, `UNAUTHENTICATED`→401.

## Review Focus

1. **Two people act on the same document** (verifier returns it while signatory view is stale, or a second click on Sign): the later action must fail with 409 `INVALID_TRANSITION`/`CONFLICT` and a toast, never double-issue. → Task 6 test `sign after reject is rejected`, Task 7 test `double sign issues one certificate`.
2. **Concurrent number allocation** (two drafts/certs created at once): numbers stay unique and gap-free per key. → Task 5 test `allocates unique sequential numbers under parallel calls`.
3. **Switching to a role that can't see the current page or item**: page redirects to that role's dashboard; API returns 403, UI shows a "not available for your role" state rather than crashing. → Task 9 test `role without access gets 403`, Task 11 e2e `switching role on a forbidden page lands on dashboard`.
4. **Running `npm run dev` a second time, or after deleting `dev.db`**: DB setup is idempotent — never reseeds over existing data, recreates if missing; `npm run db:reset` restores the seeded state. → Task 10 test `ensure-db is idempotent`.
5. **Onboarding uploads that are not PDFs or are too large (>10 MB)**: rejected with a field-level message, nothing stored. → Task 15 test `rejects non-pdf and oversize uploads`.

---

## File Structure

```
app/
  layout.tsx, providers.tsx, globals.css
  login/page.tsx                          role picker (+ user picker)
  register/[step]/page.tsx                onboarding steps 1–4
  (portal)/layout.tsx                     sidebar + header shell, role guard
  (portal)/dashboard/page.tsx             role switch → per-role dashboard component
  (portal)/requests/page.tsx
  (portal)/drafts/page.tsx
  (portal)/drafts/[id]/edit/page.tsx
  (portal)/verification/page.tsx          (verifier queue; ?view=history|returned)
  (portal)/signing/page.tsx               (signatory queue; ?view=signed)
  (portal)/certificates/page.tsx
  (portal)/authorisations/page.tsx        manager: pending registrations
  (portal)/users/page.tsx                 admin
  (portal)/audit/page.tsx
  (portal)/settings/page.tsx, settings/permissions/page.tsx
  (portal)/[...stub]/page.tsx             "Available in full release" for stub nav items
  verify/[certNo]/page.tsx                public
  api/**/route.ts                         REST handlers (thin)
src/
  domain/  types.ts, errors.ts, workflow.ts, permissions.ts, numbering.ts, validity.ts, sla.ts, checklist.ts, nav.ts
  repositories/  prisma.ts, sequences.ts
  services/  context.ts, audit.ts, requests.ts, documents.ts, certificates.ts, registrations.ts, users.ts, dashboard.ts, notifications.ts, reference.ts
  server/  session.ts, handler.ts (withActor/error mapping), schemas.ts (Zod)
  api-client/  client.ts, hooks.ts
  components/  shell/*, ui/* (shadcn), common/{StatCard,StatusPill,DataTable,DetailPanel,WorkflowStepper,FilterBar,StubPanel}.tsx, documents/{DocumentPreview,CertificatePdf}.tsx, dashboards/*.tsx
prisma/  schema.prisma, migrations/, seed.ts, seed-data/*.ts
scripts/  ensure-db.mjs, reset-db.mjs
tests/  domain/*.test.ts, services/*.test.ts, api/*.test.ts, setup/{global.ts,db.ts}
e2e/  *.spec.ts
docs/  api/openapi.yaml, reference/*.png, superpowers/…
```

## Shared Types (defined in Task 2, used everywhere)

```ts
// src/domain/types.ts
export type Role = 'ISSUANCE_OFFICER' | 'DOCUMENT_VERIFIER' | 'AUTHORISED_SIGNATORY' | 'ISSUANCE_MANAGER' | 'SYSTEM_ADMIN';
export type RequestStatus = 'SUBMITTED' | 'IN_PREPARATION' | 'IN_VERIFICATION' | 'REVISION_REQUIRED' | 'READY_FOR_SIGNING' | 'ISSUED';
export type DocumentStatus = 'IN_PROGRESS' | 'UNDER_VERIFICATION' | 'REVISION' | 'READY_FOR_SIGNING' | 'SIGNED' | 'REJECTED';
export type CertificateStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'IN_RENEWAL';
export type CertificateDisplayStatus = CertificateStatus | 'EXPIRING' | 'EXPIRED';
export type AuthorisationStatus = 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Priority = 'HIGH' | 'NORMAL' | 'LOW';
export type DocumentType = 'CERTIFICATE' | 'INSPECTION_REPORT';
export type Action =
  | 'request.create' | 'document.prepare' | 'document.edit' | 'document.submit'
  | 'document.verify' | 'document.return' | 'document.sign' | 'document.reject'
  | 'certificate.suspend' | 'certificate.reinstate' | 'certificate.revoke'
  | 'registration.decide' | 'user.manage' | 'records.viewAll';
export interface Actor { userId: string; role: Role; assignmentStatus: AuthorisationStatus; scopeCodes: string[] }
export interface WorkflowState { request: RequestStatus; document: DocumentStatus | null }
export type WorkflowEvent = 'PREPARE' | 'SUBMIT' | 'APPROVE' | 'RETURN' | 'SIGN' | 'REJECT';
export interface TransitionResult extends WorkflowState { effects: { createDraft?: true; bumpVersion?: true; issueCertificate?: true } }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
// src/domain/errors.ts
export type ErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'INVALID_TRANSITION' | 'CONFLICT' | 'UNAUTHENTICATED';
export class DomainError extends Error { constructor(public code: ErrorCode, message: string) }
```

---

### Task 1: Project scaffold, tooling and repo

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx` (redirect to `/login`), `app/globals.css`, `components.json`, `.gitignore`, `.env`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `tests/smoke.test.ts`
- Move: `2.png`…`9.png` → `docs/reference/`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `test` (vitest run), `test:e2e` (playwright), `lint`; `db:reset` and `postinstall` are added in Tasks 10 and 5. Path aliases: `@/*` → `./src/*`, `@app/*` → `./app/*` (tests import route handlers via `@app/api/...`).

- [ ] **Step 1:** `git init`, move reference PNGs to `docs/reference/`, commit existing `docs/` (spec + plan) as the first commit.
- [ ] **Step 2:** Scaffold with `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*"` into a temp dir and copy in (the target dir is non-empty). Set `"@/*": ["./src/*"]` in tsconfig, `strict: true`. `.env` contains only `DATABASE_URL="file:./dev.db"` (committed; demo only). `.gitignore` adds `prisma/*.db*`, `storage/`, `test-results/`, `playwright-report/`.
- [ ] **Step 3:** `npx shadcn@latest init` (neutral base, CSS variables), add components: button, card, input, select, dialog, tabs, table, badge, dropdown-menu, checkbox, textarea, sonner, popover, calendar, label, radio-group, separator, avatar, tooltip. Install lucide-react, recharts, @tanstack/react-query, @tanstack/react-table, zod, iron-session, qrcode, @react-pdf/renderer, date-fns; dev: vitest, @vitest/coverage-v8, @playwright/test, tsx.
- [ ] **Step 4:** Write `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`. Configure `vitest.config.ts` with the `@` alias, `environment: 'node'`, `include: ['tests/**/*.test.ts']`, `fileParallelism: false`. Playwright config: `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }`, chromium only, `testDir: 'e2e'`.
- [ ] **Step 5:** Add ESLint `no-restricted-imports` for files under `app/**` except `app/api/**`, and `src/components/**`, `src/api-client/**`: patterns `@/services/*`, `@/repositories/*`, `@/server/*`, `@prisma/client`.
- [ ] **Step 6:** Run `npm test` → 1 passed; `npm run lint` → no errors; `npm run dev` → `http://localhost:3000` redirects to `/login` (404 is fine for now).
- [ ] **Step 7:** Commit `chore: scaffold Next.js app with tooling`.

---

### Task 2: Domain types and workflow state machine

**Files:**
- Create: `src/domain/types.ts`, `src/domain/errors.ts`, `src/domain/workflow.ts`
- Test: `tests/domain/workflow.test.ts`

**Interfaces:**
- Produces: all types in "Shared Types"; `nextState(current: WorkflowState, event: WorkflowEvent): TransitionResult` (throws `DomainError('INVALID_TRANSITION', …)`); `canEditDocument(status: DocumentStatus): boolean` (true for `IN_PROGRESS`, `REVISION`).

Transition table (exhaustive; anything else throws):

| From (request / document) | Event | To | effects |
|---|---|---|---|
| SUBMITTED / null | PREPARE | IN_PREPARATION / IN_PROGRESS | createDraft |
| IN_PREPARATION / REJECTED | PREPARE | IN_PREPARATION / IN_PROGRESS | createDraft |
| IN_PREPARATION / IN_PROGRESS | SUBMIT | IN_VERIFICATION / UNDER_VERIFICATION | – |
| REVISION_REQUIRED / REVISION | SUBMIT | IN_VERIFICATION / UNDER_VERIFICATION | – |
| IN_VERIFICATION / UNDER_VERIFICATION | APPROVE | READY_FOR_SIGNING / READY_FOR_SIGNING | – |
| IN_VERIFICATION / UNDER_VERIFICATION | RETURN | REVISION_REQUIRED / REVISION | bumpVersion |
| READY_FOR_SIGNING / READY_FOR_SIGNING | SIGN | ISSUED / SIGNED | issueCertificate |
| READY_FOR_SIGNING / READY_FOR_SIGNING | REJECT | IN_PREPARATION / REJECTED | – |

- [ ] **Step 1: Write failing tests** — one `it` per row above asserting `{request, document, effects}` with `toEqual`; plus:
  - `it('rejects SIGN from UNDER_VERIFICATION')` → `expect(() => nextState({request:'IN_VERIFICATION',document:'UNDER_VERIFICATION'},'SIGN')).toThrowError(expect.objectContaining({code:'INVALID_TRANSITION'}))`
  - `it('rejects PREPARE while a live draft exists')` from `IN_PREPARATION / IN_PROGRESS`.
  - `it('nothing leaves ISSUED')` — every event from `ISSUED / SIGNED` throws.
  - `canEditDocument`: true for IN_PROGRESS, REVISION; false for the other four.
- [ ] **Step 2:** `npx vitest run tests/domain/workflow.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement as a lookup keyed by `${request}/${document ?? 'NONE'}/${event}`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(domain): workflow state machine`.

---

### Task 3: Permissions

**Files:**
- Create: `src/domain/permissions.ts`
- Test: `tests/domain/permissions.test.ts`

**Interfaces:**
- Consumes: `Role`, `Action`, `Actor` (Task 2).
- Produces: `ROLE_ACTIONS: Record<Role, readonly Action[]>`; `can(actor: Actor, action: Action, scopeCode?: string): boolean`; `assertCan(actor: Actor, action: Action, scopeCode?: string): void` (throws `DomainError('FORBIDDEN')`); `ROLES: readonly Role[]` in workflow order; `ROLE_LABEL: Record<Role, string>` ("Issuance Officer", "Document Verifier", "Authorised Signatory", "Issuance Manager", "System Administrator").

Matrix:
- ISSUANCE_OFFICER: request.create, document.prepare, document.edit, document.submit
- DOCUMENT_VERIFIER: document.verify, document.return
- AUTHORISED_SIGNATORY: document.sign, document.reject
- ISSUANCE_MANAGER: records.viewAll, certificate.suspend, certificate.reinstate, certificate.revoke, registration.decide
- SYSTEM_ADMIN: user.manage, records.viewAll

Rule: `can` is true iff action ∈ `ROLE_ACTIONS[actor.role]` AND `actor.assignmentStatus ∈ {ACTIVE, RESTRICTED}` AND (`scopeCode` undefined OR `actor.scopeCodes.includes(scopeCode)`).

- [ ] **Step 1: Write failing tests:**
  - `officer can create in own scope`: `can({userId:'u',role:'ISSUANCE_OFFICER',assignmentStatus:'ACTIVE',scopeCodes:['QMS']},'request.create','QMS')` → true
  - `officer cannot act outside scope` (scope `'CDKAB'`) → false
  - `restricted user acts within remaining scopes` (RESTRICTED, ['INS'], 'INS') → true; ('QMS') → false
  - `suspended, revoked, expired, pending users cannot act` — `it.each` over the four → false
  - `verifier cannot sign` → false; `signatory cannot verify` → false
  - `assertCan throws FORBIDDEN` → `toThrowError(expect.objectContaining({code:'FORBIDDEN'}))`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(domain): role/status/scope permissions`.

---

### Task 4: Numbering, validity, SLA, checklist

**Files:**
- Create: `src/domain/numbering.ts`, `src/domain/validity.ts`, `src/domain/sla.ts`, `src/domain/checklist.ts`
- Test: `tests/domain/numbering.test.ts`, `tests/domain/validity.test.ts`, `tests/domain/sla.test.ts`

**Interfaces:**
- Produces:
  - `requestNumber(year: number, seq: number): string` → `REQ-2026-0001` (4-digit pad, grows past 9999)
  - `draftNumber(year: number, seq: number): string` → `DRF-2026-0108`
  - `certificateNumber(schemeCode: string, year: number, seq: number): string` → `JMU-QMS-2026-0087`
  - `sequenceKey(kind: 'REQ' | 'DRF' | 'CERT', year: number, schemeCode?: string): string` → `REQ-2026`, `DRF-2026`, `CERT-QMS-2026`
  - `computeValidUntil(issueDate: Date, termMonths: number): Date` — add months, minus one day
  - `displayCertificateStatus(c: { status: CertificateStatus; validUntil: Date }, now: Date): CertificateDisplayStatus` — `EXPIRED` if `now > validUntil` and status ACTIVE/IN_RENEWAL; `EXPIRING` if ACTIVE and ≤ 30 days left; else status
  - `SLA_WORKING_DAYS: Record<Priority, number>` = `{ HIGH: 3, NORMAL: 7, LOW: 14 }`
  - `computeDueDate(createdAt: Date, priority: Priority): Date` — add N working days (skip Sat/Sun)
  - `isSlaAchieved(dueDate: Date, issuedAt: Date): boolean` — issuedAt ≤ end of dueDate's day
  - `isDueSoon(dueDate: Date, now: Date): boolean` — not past due and ≤ 7 calendar days away
  - `VERIFICATION_CHECKLIST: readonly { key: string; label: string }[]` — keys `client_data`, `scope_matches`, `results_consistent`, `references_valid`, `numbering_metadata`, `impartiality` (labels in plain English from image 6)

- [ ] **Step 1: Write failing tests:**
  - `certificateNumber('QMS', 2024, 87)` → `'JMU-QMS-2024-0087'`; `requestNumber(2024, 1032)` → `'REQ-2024-1032'`; `requestNumber(2026, 12345)` → `'REQ-2026-12345'`
  - `computeValidUntil(new Date('2024-10-14'), 36)` → 2027-10-13; `(…, 12)` → 2025-10-13
  - `displayCertificateStatus` cases: ACTIVE 31 days left → ACTIVE; 30 days → EXPIRING; past → EXPIRED; SUSPENDED past → SUSPENDED; REVOKED → REVOKED
  - `computeDueDate(Fri 2026-11-13, 'HIGH')` → Wed 2026-11-18; `(Mon 2026-11-16,'NORMAL')` → Wed 2026-11-25
  - `isSlaAchieved(due 2026-11-18, issued 2026-11-18T23:00)` → true; issued 19th → false
  - `isDueSoon`: 7 days away → true; 8 → false; yesterday → false
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with date-fns (`addMonths`, `subDays`, `addBusinessDays`, `endOfDay`), UTC-safe. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(domain): numbering, validity, SLA, checklist`.

---

### Task 5: Prisma schema, sequences and test DB harness

**Files:**
- Create: `prisma/schema.prisma`, `prisma/migrations/*` (via `prisma migrate dev --name init`), `src/repositories/prisma.ts`, `src/repositories/sequences.ts`, `tests/setup/global.ts`, `tests/setup/db.ts`
- Modify: `package.json` (`postinstall: prisma generate`), `vitest.config.ts` (globalSetup, `env.DATABASE_URL=file:./test.db`)
- Test: `tests/services/sequences.test.ts`

**Interfaces:**
- Produces: Prisma models (string-typed enums):
  - `User { id, name, email @unique, employeeId?, phone?, avatarUrl?, position?, unit?, createdAt }`
  - `RoleAssignment { id, userId, role, status, authorisedFrom?, authorisedUntil?, authorisedById?, scopes RoleAssignmentScope[] }` @@unique([userId, role])
  - `RoleAssignmentScope { assignmentId, scopeCode }` @@id([assignmentId, scopeCode])
  - `ServiceScope { code @id, name, category, schemeLabel, documentType, termMonths, schemeCode }` — seeded rows: QMS (Certification – ISO 9001, Management System, "ISO 9001:2015", CERTIFICATE, 36), ISMS (Certification – ISO 27001, "ISO/IEC 27001:2022", CERTIFICATE, 36), INS (Inspection (17020), "ISO/IEC 17020", INSPECTION_REPORT, 12), CE (Product Certification (CE/RoHS), "CE / RoHS", CERTIFICATE, 36), CDKAB (Certification – CDKAB, "CDKAB", CERTIFICATE, 36). `schemeCode` = code.
  - `Client { id, name, address? }`
  - `IssuanceRequest { id, number @unique, clientId, scopeCode, objectScope, priority, status, assigneeId?, createdById, dueDate, issuedAt?, createdAt, updatedAt }`
  - `Document { id, number @unique, requestId, type, majorVersion Int @default(1), minorVersion Int @default(0), status, fieldsJson String, preparedById, createdAt, updatedAt }`
  - `VerificationResult { id, documentId, verifierId, outcome ('APPROVED'|'RETURNED'), checklistJson, comment?, createdAt }`
  - `Signature { id, documentId @unique, signerId, signedAt }`
  - `Certificate { id, number @unique, requestId @unique, documentId @unique, type, issueDate, validUntil, status, statusReason?, verificationToken @unique, createdAt }`
  - `RegistrationApplication { id, userId, role, requestedScopes (comma string), status, personalJson, employmentJson, declarationAccepted Boolean, decidedById?, decidedAt?, decisionComment?, createdAt }`
  - `ControlDocument { id, applicationId, slot Int (1–7), fileName, storagePath, sizeBytes }`
  - `AuditLog { id, actorId?, actorRole?, action, entityType, entityId, entityLabel, comment?, at }` @@index([entityType, entityId])
  - `Notification { id, recipientRole?, recipientUserId?, message, link?, read Boolean @default(false), createdAt }`
  - `NumberSequence { key @id, next Int }`
  - `prisma: PrismaClient` singleton (global cache in dev); `type Tx = Prisma.TransactionClient`
  - `nextSequence(tx: Tx, key: string): Promise<number>` — upsert then atomic `update { next: { increment: 1 } }`, returns the value before increment (first call → 1)
  - Test helpers: `resetDb(): Promise<void>` (delete all rows in FK-safe order), `seedMinimal(): Promise<Fixture>` with `Fixture = { officer: Actor; verifier: Actor; signatory: Actor; manager: Actor; admin: Actor; clientId: string }` — all ACTIVE, officer scopes `['QMS','ISMS','CE','INS']`, others all five scopes; the five ServiceScope rows.

- [ ] **Step 1: Write failing test** `allocates unique sequential numbers under parallel calls`: `await Promise.all(Array.from({length:20},()=>prisma.$transaction(tx=>nextSequence(tx,'X'))))` → sorted result equals `[1..20]`. Plus `separate keys are independent`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Write schema, `npx prisma migrate dev --name init`, implement `prisma.ts`, `sequences.ts`, `tests/setup/global.ts` (runs `prisma migrate reset --force --skip-seed` against `file:./test.db`), `tests/setup/db.ts`. SQLite: set `PRAGMA busy_timeout=5000` on connect so parallel transactions wait instead of erroring.
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(db): prisma schema, sequences, test harness`.

---

### Task 6: Services — requests, drafts, verification, signing (with audit + notifications)

**Files:**
- Create: `src/services/context.ts`, `src/services/audit.ts`, `src/services/notifications.ts`, `src/services/requests.ts`, `src/services/documents.ts`
- Test: `tests/services/journey.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `recordAudit(tx: Tx, e: { actor?: Actor; action: string; entityType: 'REQUEST'|'DOCUMENT'|'CERTIFICATE'|'REGISTRATION'|'USER'; entityId: string; entityLabel: string; comment?: string }): Promise<void>`
  - `notify(tx: Tx, n: { recipientRole?: Role; recipientUserId?: string; message: string; link?: string }): Promise<void>`
  - `createRequest(actor: Actor, input: { clientId: string; scopeCode: string; objectScope: string; priority: Priority }): Promise<RequestDetail>` — number via `REQ-<year>`, dueDate via `computeDueDate`, status SUBMITTED, assignee = actor
  - `listRequests(actor: Actor, q: ListQuery): Promise<Page<RequestSummary> & { stats: Record<string, number> }>`
  - `getRequest(actor: Actor, id: string): Promise<RequestDetail>` (includes documents incl. rejected, workflow timeline from AuditLog)
  - `getDocument(actor: Actor, id: string): Promise<DocumentDetail>` (includes verification results, rejection reason, request summary)
  - Read access: actors with `records.viewAll` see everything; others see items in their `scopeCodes`.
  - `prepareDocument(actor: Actor, requestId: string): Promise<DocumentDetail>` — type from scope's `documentType`; `fieldsJson` prefilled from request (client name, scope, object, standard)
  - `updateDocumentFields(actor: Actor, documentId: string, fields: Record<string, string>): Promise<DocumentDetail>` — only when `canEditDocument`
  - `submitDocument(actor, documentId)`, `verifyDocument(actor, documentId, input: { checklist: Record<string, boolean>; comment?: string })` (all checklist keys must be true, else VALIDATION), `returnDocument(actor, documentId, input: { checklist: Record<string, boolean>; comment: string })` (comment required), `signDocument(actor, documentId): Promise<{ document: DocumentDetail; certificate: CertificateDetail }>`, `rejectDocument(actor, documentId, input: { reason: string })`
  - `listDocuments(actor: Actor, q: ListQuery & { queue?: 'verification' | 'signing' | 'returned' | 'verifiedByMe' | 'signedByMe' }): Promise<Page<DocumentSummary> & { stats: Record<string, number> }>` — queues filter to items the actor `can` act on (scope check)
  - `ListQuery = { q?: string; status?: string; scopeCode?: string; priority?: Priority; type?: DocumentType; from?: string; to?: string; page?: number; pageSize?: number; sort?: string; dir?: 'asc'|'desc' }`
  - `RequestSummary`, `RequestDetail`, `DocumentSummary`, `DocumentDetail` exported from `src/services/dto.ts` (plain JSON; dates as ISO strings; version as `"v1.1"`).
  - Version display = `v${major}.${minor}`; RETURN effect bumps `minorVersion`.
  - Every mutation: `prisma.$transaction(async tx => { load; assertCan(actor, action, request.scopeCode); next = nextState(...); guarded updateMany({ where: { id, status: current } }) — count 0 → DomainError('CONFLICT'); effects; recordAudit; notify next role })`.
  - Notifications: submit → DOCUMENT_VERIFIER; return/reject → the preparing officer (userId); approve → AUTHORISED_SIGNATORY; sign → officer + ISSUANCE_MANAGER.
  - `signDocument` calls `issueCertificate(tx, …)` from Task 7 (implement Task 7's function in this task as a stub returning a minimal record, or order Tasks 6 and 7 inside one PR — implementer's choice; final behaviour is tested in Task 7).

- [ ] **Step 1: Write failing tests** (using `resetDb` + `seedMinimal` in `beforeEach`):
  - `happy path ends ISSUED`: create → prepare → update fields → submit → verify (all true) → sign; assert request status `ISSUED`, document `SIGNED`, a certificate exists, audit actions in order `['request.create','document.prepare','document.edit','document.submit','document.verify','document.sign']`.
  - `return bumps version and resubmits`: … verify→return(comment 'Fix client address') → document `REVISION`, version `'v1.1'`, request `REVISION_REQUIRED`; officer `updateDocumentFields` succeeds; submit → `UNDER_VERIFICATION`.
  - `return without comment is VALIDATION`.
  - `verify with an unchecked item is VALIDATION`.
  - `signatory reject closes the draft and allows a new one`: reject(reason) → old doc `REJECTED`, request `IN_PREPARATION`; `prepareDocument` again → new doc with different number, version `'v1.0'`; `getRequest` lists both documents.
  - `sign after reject is rejected`: reject, then `signDocument` same id → throws code `INVALID_TRANSITION` or `CONFLICT`.
  - `editing a document under verification is INVALID_TRANSITION`.
  - `officer outside scope cannot create` (scope `CDKAB`) → `FORBIDDEN`.
  - `verifier cannot sign` → `FORBIDDEN`.
  - `verification queue hides out-of-scope items`: verifier with scopeCodes `['QMS']`, an INS document under verification → not in `listDocuments(verifier,{queue:'verification'})`.
  - `submit notifies verifiers`: a Notification row with `recipientRole: 'DOCUMENT_VERIFIER'` exists.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(services): request and document workflow`.

---

### Task 7: Services — certificates and lifecycle

**Files:**
- Create: `src/services/certificates.ts`, `src/services/reference.ts`
- Test: `tests/services/certificates.test.ts`

**Interfaces:**
- Produces:
  - `issueCertificate(tx: Tx, args: { request: IssuanceRequest; document: Document; scope: ServiceScope; signedAt: Date }): Promise<Certificate>` — number `certificateNumber(scope.schemeCode, year, nextSequence(tx, sequenceKey('CERT', year, scope.schemeCode)))`, `validUntil = computeValidUntil(signedAt, scope.termMonths)`, status ACTIVE, `verificationToken` = random 16-byte hex; sets `request.issuedAt`
  - `listCertificates(actor, q: ListQuery & { scheme?: string }): Promise<Page<CertificateSummary> & { stats: Record<CertificateDisplayStatus | 'TOTAL', number> }>` — status filter and stats use `displayCertificateStatus(…, now)`
  - `getCertificate(actor, id): Promise<CertificateDetail>`; `getPublicCertificate(certNo: string): Promise<PublicCertificate | null>` (no actor; returns number, client, scope, scheme, issue/valid dates, display status only)
  - `suspendCertificate(actor, id, { reason })`, `reinstateCertificate(actor, id)`, `revokeCertificate(actor, id, { reason })` — allowed: ACTIVE→SUSPENDED, SUSPENDED→ACTIVE, ACTIVE|SUSPENDED→REVOKED; else INVALID_TRANSITION; reason required for suspend/revoke
  - `verificationUrl(certNo: string, baseUrl: string): string` → `${baseUrl}/verify/${certNo}`
  - `getReference(): Promise<{ clients: {id,name}[]; scopes: ServiceScope[]; checklist: typeof VERIFICATION_CHECKLIST }>`

- [ ] **Step 1: Write failing tests:**
  - `signing issues JMU-QMS-<year>-0001 valid 36 months minus a day` (QMS request).
  - `inspection report gets JMU-INS number and 12-month validity`.
  - `double sign issues one certificate`: `Promise.allSettled([sign, sign])` → exactly one fulfilled, one rejected; certificate count 1.
  - `manager suspends, reinstates, revokes`; `revoked cannot be reinstated` → INVALID_TRANSITION; `officer cannot suspend` → FORBIDDEN; `suspend without reason` → VALIDATION.
  - `public lookup returns display status and no internal ids`: object keys equal the PublicCertificate key set; unknown number → null.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(services): certificate issuance and lifecycle`.

---

### Task 8: Services — registrations, users, dashboards, audit queries

**Files:**
- Create: `src/services/registrations.ts`, `src/services/users.ts`, `src/services/dashboard.ts`, `src/services/auditQueries.ts`, `src/services/storage.ts`
- Test: `tests/services/registrations.test.ts`, `tests/services/dashboard.test.ts`

**Interfaces:**
- Produces:
  - `REQUIRED_CONTROL_DOCUMENTS: readonly string[]` (the 7 names from image 3, in order) in `src/domain/registration.ts`
  - `submitRegistration(input: { role: Role; scopes: string[]; personal: { fullName, employeeId, nationalId, position, unit, email, phone }; employment: { education, fieldOfStudy, experienceYears: number, employmentStatus: 'PERMANENT'|'CONTRACT', startDate }; declarationAccepted: true; files: { slot: number; fileName: string; bytes: Uint8Array }[] }): Promise<{ applicationId: string; userId: string }>` — all 7 slots required; PDF only (by `%PDF-` magic bytes and `.pdf` name); each ≤ 10 MB; writes to `storage/registrations/<applicationId>/<slot>.pdf`; existing user matched by email gets a new RoleAssignment (status PENDING), otherwise a new User; duplicate assignment for same role that is not REVOKED/EXPIRED → VALIDATION; notifies ISSUANCE_MANAGER
  - `listRegistrations(actor, q: { status?: RegistrationStatus }): Promise<RegistrationSummary[]>`, `getRegistration(actor, id)`
  - `decideRegistration(actor, id, input: { decision: 'APPROVE' | 'REJECT'; comment?: string; authorisedUntil?: string }): Promise<RegistrationDetail>` — APPROVE: assignment ACTIVE, scopes set, `authorisedFrom=now`, `authorisedUntil` default now+2 years, `authorisedById=actor.userId`; REJECT: comment required, assignment REVOKED
  - `getRegistrationStatus(applicationId: string): Promise<{ status, assignmentStatus, role, scopes, authorisedFrom?, authorisedUntil?, authorisedBy? }>` (public — used by onboarding step 4)
  - `listUsers(actor)`, `updateAssignment(actor, assignmentId, { status?: AuthorisationStatus; scopeCodes?: string[] })` — `user.manage` only
  - `listLoginOptions(): Promise<{ role: Role; users: { userId; name; avatarUrl?; status }[] }[]>` — only ACTIVE/RESTRICTED assignments
  - `loadActor(userId: string, role: Role): Promise<Actor | null>`
  - `getDashboard(actor: Actor, now: Date): Promise<DashboardData>` where
    `DashboardData = { role: Role; stats: { key: string; label: string; value: number; tone: 'blue'|'amber'|'green'|'red'|'purple' }[]; queue: { id; number; client; scope; status; dueInDays?: number; link: string }[]; trend?: { label: string; issued: number; requested: number }[]; statusBreakdown?: { status: string; count: number }[]; sla?: { achievedPct: number; targetPct: 90 }; recentActivity?: { at: string; text: string; ok: boolean }[] }`
    Stats per role (labels from image 2): Officer — My Tasks, Draft, In Revision, Ready for Verification; Verifier — Awaiting Verification, Verified, Returned; Signatory — Ready to Sign, Signed, Rejected; Manager — Total Requests, In Progress, Issued, Needs Action, Due ≤7 days + trend (last 5 weekly buckets), status donut, SLA %, priority queue (top 5 by dueDate); Admin — Total Users, Active Roles, Document Templates (count of DocumentType values × scopes), Uptime (static "99.9%" label, value from config) + recent AuditLog activity.
  - `listAudit(actor, q: ListQuery & { entityType?: string; actorId?: string }): Promise<Page<AuditEntry>>` (`records.viewAll` sees everything; others only entries where they are actor or on entities they touched).

- [ ] **Step 1: Write failing tests:**
  - `rejects non-pdf and oversize uploads`: a `.png` file → VALIDATION with message naming slot; an 11 MB PDF → VALIDATION; storage dir for that attempt does not exist.
  - `missing slot is VALIDATION`.
  - `approval activates assignment and user appears in login options`.
  - `registration with existing email adds a role to that user` (one User row, two assignments).
  - `reject requires comment`.
  - `only manager can decide` → FORBIDDEN for officer.
  - `manager dashboard counts match seeded fixture` (create 3 requests at different stages; assert stat values and that `sla.achievedPct` = issued-on-time / issued × 100 rounded).
  - `admin suspends a user's assignment → loadActor returns status SUSPENDED → can() false`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(services): registrations, users, dashboards, audit`.

---

### Task 9: Session, REST API, OpenAPI contract, typed client

**Files:**
- Create: `src/server/session.ts`, `src/server/handler.ts`, `src/server/schemas.ts`, `app/api/**/route.ts` (routes below), `docs/api/openapi.yaml`, `src/api-client/client.ts`, `src/api-client/hooks.ts`, `middleware.ts`
- Test: `tests/api/routes.test.ts`

**Interfaces:**
- Produces:
  - Session cookie `jmu_session` via iron-session, payload `{ userId: string; role: Role }`; password = `process.env.SESSION_SECRET ?? <hard-coded 32+ char demo constant>` (comment: demo only).
  - `withActor<T>(handler: (actor: Actor, req: Request, ctx) => Promise<T>, opts?: { public?: boolean })` — loads session → `loadActor` → 401 if none; maps `DomainError` to the Global Constraints error JSON; Zod errors → 400 VALIDATION.
  - Routes (all JSON; list endpoints accept `ListQuery` as query params):

    | Method & path | Service |
    |---|---|
    | GET `/api/login-options` (public) | listLoginOptions |
    | GET/POST/DELETE `/api/session` | current `{user, role, roles, assignmentStatus, scopeCodes, permissions: Action[]}` (permissions = `ROLE_ACTIONS[role]` if status allows, else `[]`; the UI gates every action button on it) / login `{userId, role}` (403 unless that assignment is ACTIVE/RESTRICTED) / logout |
    | GET `/api/reference` | getReference |
    | GET, POST `/api/requests`; GET `/api/requests/:id` | listRequests, createRequest, getRequest |
    | POST `/api/requests/:id/documents` | prepareDocument |
    | GET `/api/documents`; GET, PATCH `/api/documents/:id` | listDocuments, getDocument, updateDocumentFields |
    | POST `/api/documents/:id/{submit,verify,return,sign,reject}` | matching services |
    | GET `/api/certificates`; GET `/api/certificates/:id` | listCertificates, getCertificate |
    | POST `/api/certificates/:id/{suspend,reinstate,revoke}` | matching services |
    | GET `/api/certificates/:id/pdf` | Task 13 |
    | GET `/api/public/certificates/:number` (public) | getPublicCertificate |
    | POST `/api/registrations` (public, multipart); GET `/api/registrations`; GET `/api/registrations/:id`; POST `/api/registrations/:id/decision` | registrations |
    | GET `/api/public/registrations/:id/status` (public) | getRegistrationStatus |
    | GET `/api/users`; PATCH `/api/role-assignments/:id` | users |
    | GET `/api/dashboard`; GET `/api/audit`; GET `/api/notifications`; POST `/api/notifications/read` | dashboard, audit, notifications |
    | GET `/api/permissions` | ROLE_ACTIONS matrix |

  - `api` object in `src/api-client/client.ts` with one typed method per route (e.g. `api.documents.sign(id)`); throws `ApiError { status: number; code: ErrorCode; message: string }`.
  - React Query hooks in `hooks.ts`: `useSession`, `useLoginOptions`, `useReference`, `useRequests(q)`, `useRequest(id)`, `useDocuments(q)`, `useDocument(id)`, `useCertificates(q)`, `useCertificate(id)`, `useDashboard`, `useAudit(q)`, `useNotifications`, `useRegistrations(q)`, `useUsers`, plus `useWorkflowAction()` returning `mutate({ kind: 'submit'|'verify'|'return'|'sign'|'reject'|'suspend'|'reinstate'|'revoke'|'prepare', id, body? })` that invalidates `requests`, `documents`, `certificates`, `dashboard`, `notifications`, `audit`.
  - `middleware.ts`: unauthenticated access to `(portal)` paths → redirect `/login`.

- [ ] **Step 1: Write failing tests** calling route handlers directly (`import { POST } from '@/../app/api/requests/route'` with a `Request` carrying a sealed session cookie helper `sessionCookie(userId, role)` from `tests/setup/db.ts`):
  - `unauthenticated request is 401` (GET /api/requests).
  - `role without access gets 403` (verifier POST /api/requests) with body `{ error: { code: 'FORBIDDEN' } }`.
  - `invalid body is 400 VALIDATION` (POST /api/requests missing clientId).
  - `invalid transition is 409` (sign a draft in progress).
  - `public certificate endpoint works without session`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement handlers, schemas, client, hooks, middleware; write `openapi.yaml` (OpenAPI 3.1) covering every route, request/response schema and error shape; add a test `openapi lists every route file` that globs `app/api/**/route.ts` and checks each path appears in the YAML. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): session, REST routes, OpenAPI, typed client`.

---

### Task 10: Seed data and first-run DB setup

**Files:**
- Create: `prisma/seed.ts`, `prisma/seed-data/{users,clients,requests,certificates,audit}.ts`, `scripts/ensure-db.mjs`, `scripts/reset-db.mjs`
- Modify: `package.json` scripts: `"predev": "node scripts/ensure-db.mjs"`, `"db:reset": "node scripts/reset-db.mjs"`, `"prisma": { "seed": "tsx prisma/seed.ts" }`
- Test: `tests/services/seed.test.ts`

**Interfaces:**
- Produces: `seed(prisma: PrismaClient, now: Date): Promise<void>` (deterministic: seeded PRNG, fixed seed 42).
  - Users: Andi Pratama (ISSUANCE_OFFICER, scopes QMS, ISMS, CE, INS — not CDKAB), Dewi Lestari (DOCUMENT_VERIFIER, all), Budi Santoso (AUTHORISED_SIGNATORY, all), Rina Wulandari (ISSUANCE_MANAGER, all), Fajar Hidayat (SYSTEM_ADMIN, all); plus ~37 other users across roles to reach 42 total, a few Suspended/Restricted. Avatars: generated initials (no external images).
  - Requests ~120 over the last 60 days across all statuses (≈ proportions of image 2: 60% issued, 15% in process, 10% awaiting verification, 5% revision, 10% submitted/draft), each with consistent documents, verification results, signatures and audit entries **generated by calling the domain functions** (not raw status strings) so data obeys the state machine.
  - Certificates ~450 (most backdated up to 3 years so some are EXPIRING/EXPIRED), ~8 SUSPENDED, ~4 REVOKED, ~12 IN_RENEWAL.
  - 1 pending registration for the manager to approve.
  - Andi's queue has at least: 2 SUBMITTED requests in his scopes (one HIGH), 1 REVISION_REQUIRED; Dewi has ≥3 to verify; Budi has ≥3 to sign — so every role has something to do on first login.
- `ensure-db.mjs`: if `prisma/dev.db` missing → `prisma migrate deploy` then seed; if present → `prisma migrate deploy` only (no reseed). Spawn binaries with `child_process.spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...])` to avoid `.cmd` shims and `&` in paths.
- `reset-db.mjs`: delete `prisma/dev.db*` and `storage/`, then same as missing case.

- [ ] **Step 1: Write failing tests:**
  - `seed obeys the state machine`: every request/document status pair appears in the Task 2 table's "To" column (or SUBMITTED/null); every ISSUED request has exactly one certificate.
  - `every demo role has work on first login`: `getDashboard` for each of the 5 demo actors has non-empty `queue` (admin: non-empty `recentActivity`).
  - `ensure-db is idempotent`: run `ensure-db.mjs` with `DATABASE_URL=file:./ensure-test.db` twice; user count equal after both runs; delete file; run → seeded again.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS; then `npm run db:reset` and `npm run dev` start cleanly from the repo path with `&`.
- [ ] **Step 5:** Commit `feat(seed): demo data and first-run setup`.

---

### Task 11: App shell, login, shared components

**Files:**
- Create: `app/providers.tsx`, `app/login/page.tsx`, `app/(portal)/layout.tsx`, `app/(portal)/[...stub]/page.tsx`, `src/domain/nav.ts`, `src/components/shell/{Sidebar,Header,RoleBadge,NotificationBell,UserMenu}.tsx`, `src/components/common/{StatCard,StatusPill,DataTable,DetailPanel,WorkflowStepper,FilterBar,StubPanel,EmptyState}.tsx`, `public/brand/logo.svg` (simple shield mark, original, "JMU SERTIFIKASI" wordmark text)
- Test: `e2e/shell.spec.ts`

**Interfaces:**
- Produces:
  - `NAV: Record<Role, { label: string; href: string; icon: LucideIcon; stub?: true }[]>` — Officer: Dashboard, Issuance Requests, Draft Documents, Templates(stub), Issued Certificates, Audit Trail. Verifier: Dashboard, Verification Queue, Verification History (`/verification?view=history`), Returned Documents (`?view=returned`), Audit Trail. Signatory: Dashboard, Signing Queue, Signed Documents (`/signing?view=signed`), Signature Settings(stub), Audit Trail. Manager: Dashboard, Issuance Requests, Workflow Monitoring(stub), Certificate Registry(stub), Issued Certificates, Validity & Lifecycle(stub), Pending Authorisations, Reports & Analytics(stub), Audit Trail. Admin: Dashboard, User & Role Management, Permission Matrix (`/settings/permissions`), Template Management(stub), Settings, Audit Trail. `allowedPaths(role)` derived from NAV.
  - `StatusPill({ status })` — colour map: amber = Pending Preparation/In Progress/Awaiting/Expiring; blue = In Verification/Under Verification/Normal; green = Ready for Signing/Active/Issued/Approved; red = Revision Required/Rejected/Suspended/Revoked/High; purple = Revision/In Renewal/Issued(request); grey = Draft/Expired/Low. Label = Title Case of the enum.
  - `DataTable<T>({ columns, data, total, page, pageSize, onPageChange, onSort, selectedId, onSelect })` — TanStack Table, row click selects, pagination footer "Showing a – b of N <noun>" with rows-per-page select (10/20/50).
  - `FilterBar({ searchPlaceholder, filters: { key; label; options }[], value, onChange, dateRange?: true })` — Reset button clears.
  - `DetailPanel({ title, badge, tabs: { key; label; content }[], actions })`.
  - `WorkflowStepper({ steps: { label; sub?; state: 'done'|'current'|'todo' }[] })`.
  - `StatCard({ icon, tone, value, label })`.
  - `StubPanel({ title, description })` — "Available in full release".
  - Login page: logo + hero left (navy gradient, "Certification & Issuance Portal" heading, subtitle), right card "Choose Your Role" with 5 role cards (icon, title, one-line description from image 2). Clicking a role with one user logs in; with several, opens a dialog listing users. Below: "New to the portal? Register for a role →" `/register/1`. Portal layout: header with logo, role pill ("Role: Issuance Officer"), notification bell with unread count + dropdown, help icon, user avatar/name/role; sidebar per NAV + bottom "Switch Role" button (logs out → `/login`) and the "Certification & Issuance Workflow / View Workflow" card (opens a dialog with the 5-stage end-to-end diagram from image 2).
  - Role guard: layout checks `allowedPaths(session.role)`; otherwise `redirect('/dashboard')`.

- [ ] **Step 1: Write failing e2e** `e2e/shell.spec.ts` (runs against seeded dev DB; `test.beforeAll` runs `npm run db:reset`):
  - `login as each role shows its sidebar`: for each of the 5 roles click its card → URL `/dashboard`, header shows role pill text, sidebar contains that role's first unique nav label.
  - `switching role on a forbidden page lands on dashboard`: as Officer go to `/requests`; Switch Role → Verifier; `page.goto('/requests')` → URL `/dashboard`.
  - `stub page shows full-release panel`: as Manager click "Reports & Analytics" → text "Available in full release".
  - `unauthenticated /dashboard redirects to /login`.
- [ ] **Step 2:** `npx playwright install chromium` (once), `npm run test:e2e -- shell` → FAIL.
- [ ] **Step 3:** Implement. Compare against `docs/reference/2.png` (login + shell) side by side.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): app shell, login, shared components`.

---

### Task 12: Officer screens — Issuance Requests and Draft Documents

**Files:**
- Create: `app/(portal)/requests/page.tsx`, `src/components/requests/{CreateRequestDialog,RequestDetailPanel}.tsx`, `app/(portal)/drafts/page.tsx`, `app/(portal)/drafts/[id]/edit/page.tsx`, `src/components/documents/{DraftDetailPanel,DocumentPreview,DraftEditorForm}.tsx`, `src/domain/templates.ts`
- Test: `e2e/officer.spec.ts`

**Interfaces:**
- Consumes: hooks (Task 9), common components (Task 11).
- Produces:
  - `TEMPLATE_FIELDS: Record<DocumentType, { key: string; label: string; kind: 'text'|'textarea'|'date'; required: boolean }[]>` — CERTIFICATE: clientName, clientAddress, standard, scopeStatement, sites, auditDate; INSPECTION_REPORT: clientName, objectDescription, inspectionLocation, inspectionDate, method, findings, conclusion. `submitDocument` rejects with VALIDATION if a required field is empty (add this check + a unit test `submit with empty required field is VALIDATION` to `tests/services/journey.test.ts`).
  - `DocumentPreview({ type, number, fields, status, certificateNumber?, qrUrl? })` — renders the certificate (image 9 style: logo, "CERTIFICATE", No., "This is to certify that", client, conformity sentence, standard, scope, QR, signature line "Certification Director") or the inspection report (image 8 style); diagonal "DRAFT" watermark unless SIGNED.
- Requests page = image 5: 6 stat cards (Total, Pending Preparation, In Verification, Ready for Signing, Issued, Returned/Revision), filters (search, Service Scope, Status, Priority, date range, Reset), table (Request No. link, Client, Service Scope with icon, Request Date, Status pill, Priority pill, actions view/edit/more), right `RequestDetailPanel` tabs Overview / Documents / Workflow / History with `WorkflowStepper` (Request Submitted → Preparation → Verification → Signing → Issued) and buttons *Prepare Document* (SUBMITTED, or IN_PREPARATION with no live draft) / *Open Draft* / *Request Revision* (stub toast) / More. "Create Issuance Request" opens dialog (client select, service scope select limited to actor scopes, object/scope text, priority).
- Drafts page = image 8: stat cards (Total Drafts, In Progress, Under Verification, Ready for Signing, Revision, Rejected), filters (Document Type, Service Scope, Status), table (Draft No., Request No., Client, Document Type, Version, Last Updated, Status), right panel tabs Overview / Document Data / Revision History (verifier comments, rejection reasons) + `DocumentPreview` + *Download Draft* (opens print view), *Edit Draft*, *Send to Verification*.
- Edit page: `DraftEditorForm` left, live `DocumentPreview` right; *Save* (PATCH) and *Save & Send to Verification*; shows latest verifier comment banner when status REVISION.

- [ ] **Step 1: Write failing e2e** `officer.spec.ts`:
  - `officer creates a request and prepares a draft`: login Officer → Issuance Requests → Create (PT Surya Kencana Industri, Certification – ISO 9001, "Head office quality system", High) → row appears with "Submitted" → select → Prepare Document → lands on edit page with prefilled client name → fill required fields → Save & Send to Verification → toast "Sent to verification" → Draft Documents shows the draft as "Under Verification".
  - `officer cannot pick CDKAB scope` (option absent).
  - `filters narrow the table`: Status = Issued → every visible status pill reads "Issued".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; compare with `5.png`, `8.png`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): issuance requests and draft documents`.

---

### Task 13: Verifier and Signatory screens

**Files:**
- Create: `app/(portal)/verification/page.tsx`, `app/(portal)/signing/page.tsx`, `src/components/review/{VerificationPanel,SigningPanel,ReasonDialog}.tsx`, `public/brand/signature.svg` (original stylised scribble)
- Test: `e2e/review.spec.ts`

**Interfaces:**
- Verification page (`queue=verification`; `?view=history` → `verifiedByMe`; `?view=returned` → `returned`): stats Awaiting Verification / Verified / Returned (Revision); table like image 2's "Antrean Verifikasi"; right `VerificationPanel`: document data, `DocumentPreview`, checklist from `VERIFICATION_CHECKLIST` (checkboxes), comment box, *Approve* (enabled only when all checked) and *Return for Revision* (opens `ReasonDialog`, comment required).
- Signing page (`queue=signing`; `?view=signed`): stats Ready to Sign / Signed / Rejected; table with purple "Sign" action button per row (image 2); `SigningPanel`: preview, verification summary (verifier, date, comment), *Sign Document* (confirm dialog: "Sign as Budi Santoso, Authorised Signatory?") and *Reject* (`ReasonDialog`, reason required). After sign: success dialog with certificate number and "View Certificate" link to `/certificates?select=<id>`.
- On any 409 from these actions: toast "This document was already updated by someone else" and refetch.

- [ ] **Step 1: Write failing e2e** `review.spec.ts` (each test seeds its own item through the API as Officer in `beforeEach`):
  - `verifier returns with comment and officer sees it`: Verifier → Return with "Client address incomplete" → Officer → Draft Documents → item status "Revision", version v1.1, Revision History shows the comment.
  - `approve disabled until checklist complete`.
  - `signatory rejects and request goes back to preparation`: Signatory → Reject "Wrong standard" → Officer → request status "In Preparation", Prepare Document available, Documents tab lists the rejected draft.
  - `stale action shows conflict toast`: open signing panel in page A; reject through API; click Sign in page A → toast containing "already updated".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): verification and signing queues`.

---

### Task 14: Issued Certificates, PDF, public verification

**Files:**
- Create: `app/(portal)/certificates/page.tsx`, `src/components/certificates/{CertificateDetailPanel,LifecycleActions}.tsx`, `src/components/documents/CertificatePdf.tsx`, `app/api/certificates/[id]/pdf/route.ts`, `app/verify/[certNo]/page.tsx`
- Test: `e2e/certificates.spec.ts`, `tests/api/pdf.test.ts`

**Interfaces:**
- Certificates page = image 9: 7 stat cards (Total Issued, Active, Expiring ≤30 Days, In Renewal, Suspended, Revoked, Expired), filters (Service Scope, Certification Scheme, Status), table (Certificate No., Client, Service Scope, Scheme/Standard, Issue Date, Valid Until, Status, actions), `?select=<id>` preselects; detail panel tabs Overview / Scope / Lifecycle (audit entries for the certificate) / Documents / History; Verification URL with copy button; `DocumentPreview` with QR (generated client-side with `qrcode` from `verificationUrl(number, window.location.origin)`); *Download Certificate* (→ `/api/certificates/:id/pdf`), *Share Verification Link* (copies URL), *Print* (window.print with print stylesheet showing only the preview).
- `LifecycleActions` visible only when `session.permissions` includes `'certificate.suspend'`: Suspend / Reinstate / Revoke with `ReasonDialog`.
- PDF route: `@react-pdf/renderer` `renderToBuffer(<CertificatePdf …/>)`, A4 landscape for CERTIFICATE, portrait for INSPECTION_REPORT; `Content-Disposition: attachment; filename="<number>.pdf"`; QR embedded as PNG data URL from `qrcode.toDataURL`; base URL from request `origin`.
- Public verify page: no shell; JMU header; card with certificate number, client, scope, standard, issue/valid dates, big status badge (green "Valid — Active", amber "Expiring", red "Suspended/Revoked", grey "Expired"); unknown number → "No certificate found with this number".

- [ ] **Step 1: Write failing tests:**
  - `tests/api/pdf.test.ts`: `pdf route returns a PDF` → status 200, `content-type` `application/pdf`, body starts with `%PDF`.
  - e2e `issued certificate is visible, downloadable and verifiable`: use a certificate seeded via API journey → Officer → Issued Certificates → select → Download triggers a download named `<number>.pdf` → open `/verify/<number>` in a new context without cookies → "Active".
  - e2e `manager suspends and public page shows Suspended` (reason "Client audit overdue").
  - e2e `unknown certificate shows not found`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; compare with `9.png`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): issued certificates, PDF, public verification`.

---

### Task 15: Dashboards and Audit Trail

**Files:**
- Create: `app/(portal)/dashboard/page.tsx`, `src/components/dashboards/{OfficerDashboard,VerifierDashboard,SignatoryDashboard,ManagerDashboard,AdminDashboard,TrendChart,StatusDonut,SlaGauge}.tsx`, `app/(portal)/audit/page.tsx`
- Test: `e2e/dashboards.spec.ts`

**Interfaces:**
- Consumes: `useDashboard` → `DashboardData` (Task 8).
- Layouts follow image 2 panels: page title "Dashboard – <Role label>" + subtitle; stat card row from `stats`; Officer "Document Preparation Tasks" table, Verifier "Verification Queue", Signatory "Documents Ready to Sign" with Sign buttons, Admin "Recent System Activity" list with green checks; Manager adds period selector (last 30 days default), `TrendChart` (Recharts bar = issued, line = requested), `StatusDonut` (total in centre, legend with count and %), "Priority Issuance Queue" (No., Request No., Client, Service, Status, SLA "⏱ N days"), `SlaGauge` ("92% SLA achieved", "Target ≥ 90%").
- Audit page: table (Time, User, Role, Action, Entity link, Comment), filters (search, entity type, date range), for Manager/Admin all entries, others their own.

- [ ] **Step 1: Write failing e2e:**
  - `each role dashboard shows its stat labels`: per role assert the stat labels listed in Task 8.
  - `manager dashboard reflects a new issuance`: read "Issued" value; run a full journey via API; reload → value + 1.
  - `audit trail shows the journey in order` for a request created in the test.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; compare with `2.png`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): role dashboards and audit trail`.

---

### Task 16: Onboarding, Pending Authorisations, Users, Settings

**Files:**
- Create: `app/register/[step]/page.tsx`, `src/components/onboarding/{OnboardingSidebar,StepHeader,RoleRequirements,RegistrationForm,ControlDocumentsUpload,AccessSummary}.tsx`, `src/domain/roleContent.ts`, `app/(portal)/authorisations/page.tsx`, `app/(portal)/users/page.tsx`, `app/(portal)/settings/page.tsx`, `app/(portal)/settings/permissions/page.tsx`
- Test: `e2e/onboarding.spec.ts`

**Interfaces:**
- `ROLE_CONTENT: Record<Role | 'CERTIFICATION_DECISION_MAKER', { title; coreResponsibility; keyRequirements: { label; text }[]; competencyExamples: string[]; authorisationScope: string[]; impartiality: string[]; evidence: string[] }>` — text adapted (not copied verbatim) from `6.png`; Decision Maker is informational only (not selectable for registration, shown as a note card).
- Steps (top stepper: Select Role → Role Review & Requirements → Register & Authorisation → Access to Dashboard; left navy sidebar with sub-steps and the Authorisation Status Guide legend):
  1. `/register/1` — role cards (5 + Decision Maker note).
  2. `/register/2?role=…` — image 6 layout: hero, tabs (Role Overview, Competency & Requirement, Authorisation & Impartiality, Records & Control Documents, Authorisation Status), "Personnel Authorisation Record" and "Personnel Control Documents (7)" strips, *Change Role*, *Download Role Requirements (PDF)* (stub toast), *Proceed to Registration & Authorisation*.
  3. `/register/3?role=…` — image 3 layout: profile header, "Authorisation Process" 5-step strip, section tabs (Personal Information, Role & Service Scope, Competency & Experience, Control Documents, Authorisation Details, Declaration); form fields per `submitRegistration` input; 7 upload rows with ✓ state and "n / 7 Uploaded" badge; *Save as Draft* stores form state in `localStorage` (try/catch), *Submit for Authorisation* posts multipart → `/register/4?app=<id>`.
  4. `/register/4?app=<id>` — image 4 layout: polls `/api/public/registrations/:id/status` every 5 s; shows "Awaiting Authorisation" (amber) until approved, then "Authorisation Successful" + status Active, assigned role, scope, period, authorising official, "Your Dashboard Access" grid (Your Role / Not Assigned), *Access My Dashboard* (logs in via `POST /api/session` with the new user — allowed only when assignment ACTIVE).
- Pending Authorisations (Manager): list of registrations (name, role, scopes, submitted, documents 7/7), detail with uploaded files (view via `GET /api/registrations/:id/files/:slot`, add to Task 9's route table and OpenAPI), *Approve* (authorised-until date, default +2 years) / *Reject* (comment).
- Users (Admin): table of users × assignments (role, scopes, status pill, period); edit dialog to change status (Active/Restricted/Suspended/Revoked) and scopes.
- Settings hub = image 7: 18 cards; "User Management" → `/users`, "Role & Permissions" → `/settings/permissions` (read-only matrix of `ROLE_ACTIONS`), every other card → `StubPanel` dialog.

- [ ] **Step 1: Write failing e2e** `onboarding.spec.ts`:
  - `new user registers, manager approves, user logs in`: `/register/1` → Document Verifier → Proceed → fill form, upload 7 fixture PDFs (`e2e/fixtures/sample.pdf`), accept declaration → Submit → step 4 shows "Awaiting Authorisation" → new context as Manager → Pending Authorisations → Approve → back on step 4 page, within 10 s "Authorisation Successful" → Access My Dashboard → Verifier dashboard with the new user's name in header.
  - `non-pdf upload shows an error on that row` (`e2e/fixtures/image.png`).
  - `admin suspends a user and they disappear from login options`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; compare with `3.png`, `4.png`, `6.png`, `7.png`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): onboarding, authorisations, users, settings`.

---

### Task 17: Full-journey E2E, README, final checks

**Files:**
- Create: `e2e/journey.spec.ts`, `README.md`
- Test: `e2e/journey.spec.ts`

- [ ] **Step 1: Write the journey test** exactly as the README walkthrough: db reset → Officer (Andi) creates request for PT Surya Kencana Industri, ISO 9001, High → prepares + submits → Verifier (Dewi) returns with comment → Officer fixes, resubmits (v1.1) → Verifier approves → Signatory (Budi) signs → success dialog shows `JMU-QMS-<year>-` number → Officer sees it Active in Issued Certificates → public `/verify/<number>` shows Active → Manager dashboard Issued count increased → Audit Trail lists all steps.
- [ ] **Step 2:** Run `npm run test:e2e -- journey` → PASS (if anything fails, fix in the owning task's files).
- [ ] **Step 3:** Write `README.md`: what it is (2 lines, screenshot of dashboard saved to `docs/screenshot.png`), requirements (Node 20+), **Run**: `npm install` / `npm run dev` / open http://localhost:3000, **Demo walkthrough** (the Step 1 script as numbered clicks, plus the reject path and onboarding path), **Reset**: `npm run db:reset`, **Architecture** (layers diagram + the import rule), **Moving to production**: Postgres (`provider = "postgresql"`, `DATABASE_URL`, `prisma migrate deploy`), real auth (replace `src/server/session.ts` + login page; services already take an `Actor`), file storage (swap `src/services/storage.ts`), **Replacing the backend in Python/Go**: implement `docs/api/openapi.yaml`, point the UI at it with `NEXT_PUBLIC_API_BASE_URL` (add this env read to `src/api-client/client.ts`, default same-origin), port `src/domain/*` rules (they're framework-free and covered by `tests/domain`).
- [ ] **Step 4: Clean-clone check:** `git clone . ../jmu-clean-check` into a path containing a space and `&`, then `npm install` and `npm run dev` there; open `/login`, log in as each role; delete the clone. Then `npm test`, `npm run lint`, `npm run build` all pass in the main repo.
- [ ] **Step 5:** Commit `docs: README and full-journey e2e`.
