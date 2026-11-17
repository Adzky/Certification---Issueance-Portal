/**
 * Environment for the e2e dev server and the e2e database reset (ruling R4).
 * Port, build output, database and storage are all separate from a developer's own
 * `npm run dev`, so both can run side by side.
 */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_ENV: Record<string, string> = {
  NEXT_DIST_DIR: '.next-e2e',
  DATABASE_URL: 'file:./e2e.db',
  STORAGE_DIR: 'storage-e2e',
};
