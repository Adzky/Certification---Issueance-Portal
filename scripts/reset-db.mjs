// `npm run db:reset`: brings the demo database back to its freshly seeded state.
// The database file is never deleted (a running dev server may hold it open on Windows):
// migrate, delete every row, reseed, and clear uploaded files.
import fs from 'node:fs';
import { loadEnv, migrateDeploy, runSeed, storageDir } from './db-tools.mjs';

loadEnv();
if (!migrateDeploy()) process.exit(1);
// Clear stored files first: the seed writes the pending registration's PDFs into storage.
fs.rmSync(storageDir(), { recursive: true, force: true });
if (!runSeed('--reset')) process.exit(1);
