import type { ServiceScope } from '@prisma/client';
import { prisma } from '@/repositories/prisma';
import { VERIFICATION_CHECKLIST } from '@/domain/checklist';

export async function getReference(): Promise<{
  clients: { id: string; name: string }[];
  scopes: ServiceScope[];
  checklist: typeof VERIFICATION_CHECKLIST;
}> {
  const [clients, scopes] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.serviceScope.findMany({ orderBy: { code: 'asc' } }),
  ]);
  return { clients, scopes, checklist: VERIFICATION_CHECKLIST };
}
