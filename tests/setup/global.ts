import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds a fresh test DB (prisma/test.db) before the suite. Deletes only that
 * throwaway file, then applies migrations with `migrate deploy` (the
 * `migrate reset` command is blocked by Prisma's AI-agent guard).
 */
export default function setup(): void {
  const root = path.resolve(__dirname, '..', '..');
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(path.join(root, 'prisma', `test.db${suffix}`), { force: true });
  }
  const res = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    { cwd: root, env: { ...process.env, DATABASE_URL: 'file:./test.db' }, encoding: 'utf8' },
  );
  if (res.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${res.stdout}\n${res.stderr}`);
  }
}
