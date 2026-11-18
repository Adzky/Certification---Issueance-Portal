# Vercel Deployment Design

## Intent

Let reviewers deploy the existing certification portal to Vercel and exercise the demo
workflow online, with changes persisting between requests.

## Goals

- Keep the existing Next.js App Router, REST API, Prisma schema, and local development
  workflow.
- Use Turso/libSQL for a shared database and Cloudflare R2 for persistent uploaded files.
- Document platform setup, required environment variables, schema migration, and demo
  seeding without requiring Vercel to run destructive setup during a build.
- Preserve local SQLite and filesystem storage when cloud credentials are not configured.

## Non-goals and constraints

- This does not add real authentication or make the demo safe for real personal documents;
  documentation must continue to warn against real data.
- No PostgreSQL migration or automated cloud account/credential provisioning.
- Stay on the standard Next.js build and Vercel's Next.js integration; do not make a static
  export because the app needs server-side route handlers.
- Turso schema migrations must use the supported SQLite migration workflow rather than
  `prisma migrate deploy` against the remote database.
- Free-tier use is subject to provider quotas and may require a payment method for R2.

## Approaches

| Approach | Trade-off | Decision |
| --- | --- | --- |
| Turso/libSQL + R2 | Reuses the current SQLite-compatible Prisma adapter and schema; requires external service credentials and an explicit remote migration/seed step. | **Chosen** |
| PostgreSQL + object storage | Conventional production stack, but needs a database adapter and schema/migration changes beyond deployment enablement. | Rejected for this deployment-focused request. |
| Platform configuration only | Smallest change, but local SQLite and uploads are not durable or guaranteed to work in serverless instances. | Rejected because reviewers need to complete the workflow reliably. |

## Design

- Extend the existing Prisma client to accept a remote libSQL URL and auth token while
  retaining the current file-URL behavior locally.
- Extend the existing storage service to use an S3-compatible bucket (Cloudflare R2) when
  configured, while retaining local filesystem storage for development and tests.
- Provide explicit, repeatable setup steps for creating the remote schema and seeding the
  sample workflow data; do not run migrations or demo seeding automatically on each deploy.
- Document the Vercel setup and required environment variables. Set a real `SESSION_SECRET`
  and `PUBLIC_BASE_URL` for the deployed site.
- Make clear that the login remains a public demo-user picker and that no real personal data
  may be uploaded.
