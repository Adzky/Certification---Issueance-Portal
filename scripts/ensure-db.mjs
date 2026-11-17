// Runs before `npm run dev`: applies migrations, and seeds the demo data when the SQLite file
// did not exist yet. An existing database is never reseeded.
import { dbFilePath, loadEnv, migrateDeploy, removeDbFiles, runSeed } from './db-tools.mjs';
import fs from 'node:fs';

loadEnv();
const file = dbFilePath();
const existed = file !== null && fs.existsSync(file);

if (!migrateDeploy()) process.exit(1);

if (file !== null && !existed) {
  console.log('First run: seeding demo data...');
  if (!runSeed()) {
    // Do not leave a half-seeded database behind: the next start would skip seeding.
    removeDbFiles(file);
    process.exit(1);
  }
}
