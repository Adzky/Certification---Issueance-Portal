import type { Config } from '@libsql/client';
import { resolveDbUrl } from './db-url';

export function createLibSqlConfig(
  databaseUrl = process.env.DATABASE_URL,
  authToken = process.env.TURSO_AUTH_TOKEN,
): Config {
  const config: Config = {
    url: resolveDbUrl(databaseUrl),
    timeout: 5000,
  };
  if (authToken) config.authToken = authToken;
  return config;
}
