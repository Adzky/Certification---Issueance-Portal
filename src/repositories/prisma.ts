import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { resolveDbUrl } from './db-url';

export type Tx = Prisma.TransactionClient;

function createClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: resolveDbUrl(process.env.DATABASE_URL) });
  const client = new PrismaClient({ adapter });
  // SQLite: wait for the write lock instead of failing immediately.
  void client.$executeRawUnsafe('PRAGMA busy_timeout=5000').catch(() => undefined);
  return client;
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
