import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations } from '../../scripts/migrate-turso.mjs';

describe('Turso schema migrations', () => {
  let directory: string;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-turso-migrations-'));
    client = createClient({ url: 'file::memory:' });
  });

  afterEach(async () => {
    client.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('applies the app schema once and skips completed migrations on rerun', async () => {
    const migrationsDir = path.resolve(process.cwd(), 'prisma', 'migrations');

    expect(await applyMigrations(client, migrationsDir)).toBe(1);
    expect(await applyMigrations(client, migrationsDir)).toBe(0);

    const result = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'");
    expect(result.rows).toHaveLength(1);
  });

  it('rolls back a failed migration without marking it as applied', async () => {
    const migrationsDir = path.join(directory, 'migrations');
    const migrationDir = path.join(migrationsDir, '20261118000000_failing');
    await fs.mkdir(migrationDir, { recursive: true });
    await fs.writeFile(
      path.join(migrationDir, 'migration.sql'),
      'CREATE TABLE partial_change (id TEXT PRIMARY KEY); INSERT INTO missing_table VALUES (1);',
    );

    await expect(applyMigrations(client, migrationsDir)).rejects.toThrow();

    const schema = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'partial_change'");
    const applied = await client.execute('SELECT migration_name FROM _portal_migrations');
    expect(schema.rows).toHaveLength(0);
    expect(applied.rows).toHaveLength(0);
  });
});
