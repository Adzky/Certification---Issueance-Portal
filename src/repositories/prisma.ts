import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { resolveDbUrl } from './db-url';

export type Tx = Prisma.TransactionClient;

function createClient(): PrismaClient {
  const adapter = new PrismaLibSql({
    url: resolveDbUrl(process.env.DATABASE_URL),
    // SQLite busy timeout (ms): wait for the write lock instead of failing immediately. Applied
    // by @libsql/client to every pooled connection, unlike a one-off PRAGMA on a single connection.
    timeout: 5000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
