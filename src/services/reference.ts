import { prisma } from '@/repositories/prisma';
import { VERIFICATION_CHECKLIST } from '@/domain/checklist';
import type { DocumentType } from '@/domain/types';
import type { PublicScope, ReferenceData } from '@/contract/types';

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

/** Code, name and category of every service scope, for the unauthenticated onboarding form. */
export async function listPublicScopes(): Promise<PublicScope[]> {
  return prisma.serviceScope.findMany({ select: { code: true, name: true, category: true }, orderBy: { code: 'asc' } });
}
