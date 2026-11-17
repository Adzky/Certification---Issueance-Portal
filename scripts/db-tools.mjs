// Shared helpers for ensure-db.mjs and reset-db.mjs.
// Tools are started through their JS entry files with the current node binary: no .cmd
// shims and no shell, so checkout paths containing spaces or "&" work on every OS.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Loads `.env` (existing environment variables win) and defaults DATABASE_URL to prisma/dev.db. */
export function loadEnv() {
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'file:./dev.db';
}

/** Absolute path of the SQLite file DATABASE_URL points at, or null for non-file URLs. */
export function dbFilePath() {
  const url = process.env.DATABASE_URL;
  if (!url.startsWith('file:')) return null;
  const p = url.slice('file:'.length).split('?')[0];
  return path.isAbsolute(p) ? p : path.resolve(root, 'prisma', p);
}

export function removeDbFiles(file) {
  for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
}

function run(label, entry, args) {
  const res = spawnSync(process.execPath, [path.join(root, entry), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (res.error || res.status !== 0) {
    console.error(`${label} failed${res.error ? `: ${res.error.message}` : ` (exit ${res.status})`}`);
    return false;
  }
  return true;
}

export const migrateDeploy = () =>
  run('prisma migrate deploy', 'node_modules/prisma/build/index.js', ['migrate', 'deploy']);

/** Runs prisma/seed.ts through tsx; a failed seed (any non-zero exit) is reported, never masked. */
export const runSeed = (...flags) =>
  run('Seeding', 'node_modules/tsx/dist/cli.mjs', ['prisma/seed.ts', ...flags]);

export function storageDir() {
  return path.resolve(process.env.STORAGE_DIR ?? path.join(root, 'storage'));
}
