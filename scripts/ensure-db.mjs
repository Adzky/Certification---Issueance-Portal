// Runs before `npm run dev`: applies migrations and seeds the demo data unless a previous seed
// completed. Completion is recorded by the seed's very last write (a NumberSequence row), so a
// first run that was interrupted halfway is detected and redone on the next start. A completed
// database is never reseeded.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { SEED_MARKER_KEY, dbFilePath, loadEnv, migrateDeploy, runSeed, storageDir } from './db-tools.mjs';

loadEnv();
if (!migrateDeploy()) process.exit(1);

const file = dbFilePath();
if (file !== null) {
  const client = createClient({ url: `file:${file.replaceAll(path.sep, '/')}` });
  let seeded = false;
  try {
    const r = await client.execute({ sql: 'select 1 from NumberSequence where key = ?', args: [SEED_MARKER_KEY] });
    seeded = r.rows.length > 0;
  } finally {
    client.close();
  }
  if (!seeded) {
    console.log('Seeding demo data...');
    fs.rmSync(storageDir(), { recursive: true, force: true });
    if (!runSeed('--reset')) process.exit(1);
  }
}
