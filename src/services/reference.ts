import { prisma } from '@/repositories/prisma';
import { VERIFICATION_CHECKLIST } from '@/domain/checklist';
import type { DocumentType } from '@/domain/types';
import type { ReferenceData } from '@/contract/types';

export async function getReference(): Promise<ReferenceData> {
  const [clients, scopes] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.serviceScope.findMany({ orderBy: { code: 'asc' } }),
  ]);
  return {
    clients,
    scopes: scopes.map((s) => ({
      code: s.code,
      name: s.name,
      category: s.category,
      schemeLabel: s.schemeLabel,
      schemeCode: s.schemeCode,
      documentType: s.documentType as DocumentType,
      termMonths: s.termMonths,
    })),
    checklist: VERIFICATION_CHECKLIST,
  };
}
