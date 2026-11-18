# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable a persistent online demo deployment of the Next.js certification portal to Vercel.

**Architecture:** Keep the existing Prisma SQLite schema and local development defaults, adding authenticated remote libSQL connections for Turso. Keep the existing storage API, selecting Cloudflare R2 through its S3-compatible API only when explicitly configured; provide explicit remote migration and demo-seed commands.

**Tech Stack:** Next.js 16 App Router, Prisma 7, `@prisma/adapter-libsql`, `@libsql/client`, AWS SDK for S3, Vitest.

**Spec:** [2026-11-18-vercel-deployment-design.md](../specs/2026-11-18-vercel-deployment-design.md)

## Global Constraints

- Node.js version is `>=20`.
- Keep the existing Next.js server build; do not use static export.
- Preserve local SQLite (`file:` URL) and local filesystem storage by default.
- For remote use, configure `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION=auto`.
- Configure a real `SESSION_SECRET` of at least 32 characters and the deployed `PUBLIC_BASE_URL`.
- Never run remote schema migrations or demo seeding automatically during platform builds or function requests.
- This remains a demo with a public demo-user picker; do not use real personal data or documents.

## Review Focus

- A `libsql://` URL must stay remote and include its auth token; pin both that and unchanged local `file:` resolution in the repository config test.
- Missing R2 settings must fail explicitly rather than silently writing to ephemeral local disk; pin this in the storage test.
- S3 reads must return the exact bytes and surface a missing/invalid response; pin this in the storage test.
- Deleting an application must remove only its full object prefix, including paginated listings; pin this in the storage test.
- Reapplying remote migrations must skip completed migrations, and a failed migration must not be recorded as completed; pin both in the migration test.

---

### Task 1: Configure the Prisma libSQL adapter for Turso

**Files:**
- Create: `src/repositories/libsql-config.ts`
- Modify: `src/repositories/prisma.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/repositories/libsql-config.test.ts`

**Interfaces:**
- Produces `createLibSqlConfig(databaseUrl?: string, authToken?: string): Config`, returning a resolved URL, the existing 5000 ms timeout, and an auth token only when provided.
- `prisma.ts` uses this config to create its adapter; local environment behavior remains unchanged.

- [ ] **Step 1: Write failing tests** for `libsql://demo-org.turso.io` remaining unchanged with the supplied token, and `file:./dev.db` resolving locally without a token.
- [ ] **Step 2: Run `npm test -- tests/repositories/libsql-config.test.ts`** and confirm the tests fail because the helper does not exist.
- [ ] **Step 3: Add `@libsql/client` as a direct dependency, implement `createLibSqlConfig`**, and use it in the existing Prisma singleton.
- [ ] **Step 4: Run `npm test -- tests/repositories/libsql-config.test.ts tests/services/sqlite-driver.test.ts`**; both local and remote config assertions must pass.
- [ ] **Step 5: Commit** as `feat: support Turso database connections`.

### Task 2: Add durable S3-compatible file storage

**Files:**
- Create: `src/services/s3-storage.ts`
- Modify: `src/services/storage.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/services/storage.test.ts`

**Interfaces:**
- Preserve `saveControlDocument(applicationId, slot, bytes)`, `readControlDocument(storagePath)`, and `deleteApplicationFiles(applicationId)` in `src/services/storage.ts`.
- Select local storage by default; select S3-compatible storage only for `STORAGE_DRIVER=s3`.
- S3 configuration uses `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION` (default `auto`).

- [ ] **Step 1: Write failing tests** for local-default storage, S3 upload and byte-for-byte read, missing S3 configuration failing explicitly, and deletion limited to an application's prefix across multiple listing pages.
- [ ] **Step 2: Run `npm test -- tests/services/storage.test.ts`** and confirm the new storage cases fail.
- [ ] **Step 3: Add the AWS S3 client dependency and implement the S3-backed operations**, keeping the existing local filesystem path and API.
- [ ] **Step 4: Run `npm test -- tests/services/storage.test.ts tests/services/registrations.test.ts`**; cloud behavior must be covered with a mocked S3 client and existing local registration tests must remain green.
- [ ] **Step 5: Commit** as `feat: persist uploaded documents in S3 storage`.

### Task 3: Provide explicit Turso migration and demo-seed commands

**Files:**
- Create: `scripts/migrate-turso.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/scripts/migrate-turso.test.ts`

**Interfaces:**
- Export `applyMigrations(client, migrationsDir): Promise<number>` from `scripts/migrate-turso.mjs`; it applies sorted SQL files once and records completion in a dedicated migration table.
- Add `npm run db:migrate:turso` for schema setup and `npm run db:seed:demo` for the existing `prisma/seed.ts`.
- Require `DATABASE_URL`; require `TURSO_AUTH_TOKEN` for a remote URL. Report errors and migration counts explicitly.

- [ ] **Step 1: Write failing tests** using a temporary local libSQL database: applying migrations creates the app tables, a second run applies zero migrations, and a failed migration is not marked complete.
- [ ] **Step 2: Run `npm test -- tests/scripts/migrate-turso.test.ts`** and confirm the migration helper is missing.
- [ ] **Step 3: Implement the migration helper and npm commands**, applying each migration transactionally and never invoking either command from `build`, `dev`, or a platform function.
- [ ] **Step 4: Run `npm test -- tests/scripts/migrate-turso.test.ts tests/services/seed.test.ts`**; migration reruns and existing sample seeding behavior must pass.
- [ ] **Step 5: Commit** as `feat: add explicit Turso setup commands`.

### Task 4: Document Vercel deployment

**Files:**
- Modify: `README.md`

**Interfaces:**
- Vercel uses automatic Next.js detection and the existing `npm run build` command; no static export or custom Vercel builder is introduced.
- The README provides Vercel setup, environment variable names, explicit migration and seed commands, and a warning that free quotas/payment requirements vary.

- [ ] **Step 1: Update the README** with Vercel setup, Turso/R2 configuration, one-time schema migration and demo seeding, and the demo-only data warning.
- [ ] **Step 2: Run `npm test`, `npm run lint`, and `npm run build`**; all must pass, confirming the standard production build still includes the app's API routes.
- [ ] **Step 3: Commit** as `docs: explain Vercel deployment`.
