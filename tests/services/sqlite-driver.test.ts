import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT_DIR = path.resolve(__dirname, '..', '..', 'node_modules', '@libsql', 'client');

// Regression guard for the intermittent native access violation (exit 3221225477 / 139).
// @libsql/client 0.17 opened a fresh native connection for every interactive transaction and
// never closed it; when V8 garbage-collected those handles, libsql's native finalizer crashed
// the process. Prisma runs every `$transaction` through `client.transaction()`, so both the seed
// and a long-running `next dev` hit it. The child counts native connections opened and closed
// (0.17.4: 200 opened, 0 closed, then a segfault) while forcing GC between transactions.
const SCRIPT = `
const clientDir = process.argv[1];
const libsqlPath = require.resolve('libsql', { paths: [clientDir] });
const Native = require(libsqlPath);
let opened = 0, closed = 0;
class Counted extends Native {
  constructor(...args) { super(...args); opened++; }
  close() { if (this.open) closed++; return super.close(); }
}
require.cache[libsqlPath].exports = Counted;
const { createClient } = require(clientDir);
(async () => {
  const c = createClient({ url: 'file:' + process.argv[2] });
  await c.execute('create table t (id integer primary key, v text)');
  for (let i = 0; i < 200; i++) {
    const tx = await c.transaction('deferred');
    await tx.execute({ sql: 'insert into t (v) values (?)', args: ['x'] });
    await tx.commit();
    if (i % 25 === 0) global.gc();
  }
  c.close();
  global.gc();
  console.log(JSON.stringify({ opened, closed }));
})();
`;

describe('SQLite driver', () => {
  it('reuses and closes the native connections behind interactive transactions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-gc-'));
    try {
      const res = spawnSync(process.execPath, ['--expose-gc', '-e', SCRIPT, CLIENT_DIR, path.join(dir, 'gc.db')], {
        encoding: 'utf8',
        timeout: 60_000,
      });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
      const { opened, closed } = JSON.parse(res.stdout) as { opened: number; closed: number };
      expect(closed).toBe(opened);
      expect(opened).toBeLessThanOrEqual(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);
});
