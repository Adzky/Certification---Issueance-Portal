import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { E2E_ENV } from './env';

const root = path.resolve(__dirname, '..');

/** Resets the e2e database to its seeded state (`scripts/reset-db.mjs` with the e2e env). */
export function resetDb(): void {
  const res = spawnSync(process.execPath, [path.join(root, 'scripts', 'reset-db.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...E2E_ENV },
  });
  if (res.error || res.status !== 0) {
    throw new Error(`e2e database reset failed${res.error ? `: ${res.error.message}` : ` (exit ${res.status})`}`);
  }
}
