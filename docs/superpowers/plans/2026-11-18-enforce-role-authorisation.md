# Enforcing role authorisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deny login, requests, actions, and scoped reads when a role assignment is inactive or outside its authorisation dates.

**Architecture:** Add one framework-free validity predicate to the domain permission module and carry optional authorisation bounds on `Actor`. Reuse it for action checks and scoped reads; filter login options in the database and reject invalid actors in `currentActor`, while retaining `loadActor` status inspection.

**Tech Stack:** TypeScript, Prisma, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-enforce-role-authorisation-design.md`

## Global Constraints

- Null date bounds remain unbounded for legacy assignments.
- Bounds are inclusive instants.
- Keep `loadActor` able to report inactive assignment details.
- Do not add schema or deployment-provider changes.

## Review Focus

- A not-yet-active assignment must be rejected; pin in Task 1 with a future `authorisedFrom` permission test.
- An assignment at its exact `authorisedUntil` instant remains valid, while one after it is invalid; pin both boundary cases in Task 1.
- Legacy assignments with null bounds remain usable; pin in Task 1.
- A `RESTRICTED` assignment retains reads only in its remaining scopes; pin in Task 1.
- An inactive manager/admin must not regain unrestricted reads from `records.viewAll`; pin in Task 1.

---

### Task 1: Enforce assignment validity in domain permissions and reads

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/permissions.ts`
- Modify: `src/services/context.ts`
- Test: `tests/domain/permissions.test.ts`
- Create: `tests/services/context.test.ts`

**Interfaces:**
- Produces: `isAssignmentCurrentlyUsable(actor: Pick<Actor, 'assignmentStatus' | 'authorisedFrom' | 'authorisedUntil'>, now?: Date): boolean` in `src/domain/permissions.ts`; optional `Date` bounds on `Actor`.
- `can` and `readableScopes` must use that predicate. `readableScopes` returns `[]` for unusable actors, `null` for usable `records.viewAll` actors, and the actor's scopes otherwise.

- [ ] **Step 1: Write failing tests**

Add permission tests proving that future start bounds and passed end bounds deny actions, exact inclusive bounds and absent bounds are allowed, and a restricted actor remains limited to listed scopes. Add context tests proving suspended and expired managers/admins get no readable scopes, active managers/admins remain unrestricted, and a restricted actor receives only its scopes.

- [ ] **Step 2: Run focused tests and verify they fail for the missing validity behavior**

Run: `npm test -- tests/domain/permissions.test.ts tests/services/context.test.ts`
Expected: FAIL because the validity predicate is absent and inactive actors retain readable scopes.

- [ ] **Step 3: Implement the shared validity predicate and apply it**

Add optional `authorisedFrom` and `authorisedUntil` dates to `Actor`; implement the predicate with allowed statuses `ACTIVE`/`RESTRICTED`, inclusive optional date bounds, and an injectable `now`; use it in `can` and `readableScopes`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/domain/permissions.test.ts tests/services/context.test.ts`
Expected: both test files pass.

- [ ] **Step 5: Run the complete test suite**

Run: `npm test`
Expected: all test files pass.

### Task 2: Enforce assignment validity at login and session resolution

**Files:**
- Modify: `src/services/registrations.ts`
- Modify: `src/server/handler.ts`
- Modify: `app/api/session/route.ts`
- Modify: `src/services/users.ts`
- Test: `tests/services/registrations.test.ts`
- Test: `tests/api/routes.test.ts`

**Interfaces:**
- Consumes: Task 1's `isAssignmentCurrentlyUsable` predicate and `Actor` date fields.
- Produces: `loadActor` includes non-null database authorisation bounds; login options and login POST reject assignments outside their date window; `currentActor` returns `null` when the resolved assignment is unusable. `GET /api/session` remains a self-status view for an existing signed cookie, with no permissions for unusable assignments.

- [ ] **Step 1: Write failing tests**

Add a registration test showing an expired assignment is absent from login options while `loadActor` still reports its status and bounds. Add API tests showing protected requests with expired and suspended assignments return `401 UNAUTHENTICATED`, login POST refuses an expired assignment without setting a cookie, and `GET /api/session` reports no permissions for an expired assignment.

- [ ] **Step 2: Run focused tests and verify they fail for the expected reasons**

Run: `npm test -- tests/services/registrations.test.ts tests/api/routes.test.ts`
Expected: FAIL because login options include expired assignments and `currentActor` accepts unusable assignments.

- [ ] **Step 3: Implement login filtering and session rejection**

Map `authorisedFrom`/`authorisedUntil` into `Actor`. Query login-eligible rows with `ACTIVE`/`RESTRICTED` status and nullable inclusive bounds against one captured current time. Use the same predicate in login POST and have `currentActor` return `null` when it is false. Keep `GET /api/session` as an explicit self-status path that uses `loadActor` and returns empty permissions for unusable assignments.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/services/registrations.test.ts tests/api/routes.test.ts`
Expected: both test files pass.

- [ ] **Step 5: Run the complete test suite**

Run: `npm test`
Expected: all test files pass.
