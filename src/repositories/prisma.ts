import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createLibSqlConfig } from './libsql-config';

export type Tx = Prisma.TransactionClient;

function createClient(): PrismaClient {
  const adapter = new PrismaLibSql(createLibSqlConfig());
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
