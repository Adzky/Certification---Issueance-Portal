import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { resolveDbUrl } from './src/repositories/db-url';

// Prisma 7 no longer loads .env on its own. Existing env vars win.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: resolveDbUrl(process.env.DATABASE_URL, __dirname) },
});
