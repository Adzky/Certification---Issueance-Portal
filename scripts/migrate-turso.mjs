import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { createLibSqlConfig } from '../src/repositories/libsql-config.ts';
import { loadEnv } from './db-tools.mjs';

/**
 * Applies ordered SQLite migration folders once each, recording each migration in the same
 * transaction as its schema changes.
 * @param {import('@libsql/client').Client} client
 * @param {string} migrationsDir
 * @returns {Promise<number>}
 */
export async function applyMigrations(client, migrationsDir) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _portal_migrations (
      migration_name TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const appliedResult = await client.execute('SELECT migration_name FROM _portal_migrations');
  const applied = new Set(appliedResult.rows.map((row) => String(row.migration_name)));
  const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  let appliedCount = 0;

  for (const migrationName of migrationDirs) {
    if (applied.has(migrationName)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, migrationName, 'migration.sql'), 'utf8');
    const transaction = await client.transaction('write');
    try {
      await transaction.executeMultiple(sql);
      await transaction.execute({
        sql: 'INSERT INTO _portal_migrations (migration_name) VALUES (?)',
        args: [migrationName],
      });
      await transaction.commit();
      appliedCount += 1;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  return appliedCount;
}

async function runCli() {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.startsWith('file:')) {
    throw new Error('Set DATABASE_URL to a remote Turso libSQL URL before running db:migrate:turso');
  }
  if (!process.env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN is required before running db:migrate:turso');
  }

  const client = createClient(createLibSqlConfig(databaseUrl, process.env.TURSO_AUTH_TOKEN));
  try {
    const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'migrations');
    const appliedCount = await applyMigrations(client, migrationsDir);
    console.log(`Applied ${appliedCount} Turso migration${appliedCount === 1 ? '' : 's'}.`);
  } finally {
    client.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
