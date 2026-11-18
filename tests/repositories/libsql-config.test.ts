import { describe, expect, it } from 'vitest';
import { createLibSqlConfig } from '@/repositories/libsql-config';

describe('createLibSqlConfig', () => {
  it('preserves a remote Turso URL and its authentication token', () => {
    expect(createLibSqlConfig('libsql://demo-org.turso.io', 'turso-secret')).toEqual({
      url: 'libsql://demo-org.turso.io',
      authToken: 'turso-secret',
      timeout: 5000,
    });
  });

  it('resolves a local SQLite URL and omits authentication when no token is supplied', () => {
    const config = createLibSqlConfig('file:./dev.db');

    expect(config.url).toBe(resolveLocalDatabaseUrl());
    expect(config.timeout).toBe(5000);
    expect(config).not.toHaveProperty('authToken');
  });
});

function resolveLocalDatabaseUrl(): string {
  return `file:${process.cwd().replaceAll('\\', '/')}/prisma/dev.db`;
}
