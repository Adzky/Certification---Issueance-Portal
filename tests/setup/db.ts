import { prisma } from '@/repositories/prisma';
import { truncateAll } from '@/repositories/truncate';
import type { Actor, Role } from '@/domain/types';
import { SESSION_COOKIE, sealSession } from '@/server/session';

export interface Fixture {
  officer: Actor;
  verifier: Actor;
  signatory: Actor;
  manager: Actor;
  admin: Actor;
  clientId: string;
}

const SCOPES = [
  { code: 'QMS', name: 'Certification – ISO 9001', category: 'Management System', schemeLabel: 'ISO 9001:2015', documentType: 'CERTIFICATE', termMonths: 36 },
  { code: 'ISMS', name: 'Certification – ISO 27001', category: 'Management System', schemeLabel: 'ISO/IEC 27001:2022', documentType: 'CERTIFICATE', termMonths: 36 },
  { code: 'INS', name: 'Inspection (17020)', category: 'Inspection', schemeLabel: 'ISO/IEC 17020', documentType: 'INSPECTION_REPORT', termMonths: 12 },
  { code: 'CE', name: 'Product Certification (CE/RoHS)', category: 'Product Certification', schemeLabel: 'CE / RoHS', documentType: 'CERTIFICATE', termMonths: 36 },
  { code: 'CDKAB', name: 'Certification – CDKAB', category: 'Management System', schemeLabel: 'CDKAB', documentType: 'CERTIFICATE', termMonths: 36 },
];

/** Deletes every row, children before parents. */
export async function resetDb(): Promise<void> {
  await truncateAll(prisma);
}

export async function seedMinimal(): Promise<Fixture> {
  await prisma.serviceScope.createMany({ data: SCOPES.map((s) => ({ ...s, schemeCode: s.code })) });
  const all = SCOPES.map((s) => s.code);
  const make = async (key: string, role: Actor['role'], scopeCodes: string[]): Promise<Actor> => {
    const user = await prisma.user.create({ data: { name: `Test ${key}`, email: `${key}@test.local` } });
    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role,
        status: 'ACTIVE',
        scopes: { create: scopeCodes.map((scopeCode) => ({ scopeCode })) },
      },
    });
    return { userId: user.id, role, assignmentStatus: 'ACTIVE', scopeCodes };
  };
  const officer = await make('officer', 'ISSUANCE_OFFICER', ['QMS', 'ISMS', 'CE', 'INS']);
  const verifier = await make('verifier', 'DOCUMENT_VERIFIER', all);
  const signatory = await make('signatory', 'AUTHORISED_SIGNATORY', all);
  const manager = await make('manager', 'ISSUANCE_MANAGER', all);
  const admin = await make('admin', 'SYSTEM_ADMIN', all);
  const client = await prisma.client.create({ data: { name: 'PT Surya Kencana Industri' } });
  return { officer, verifier, signatory, manager, admin, clientId: client.id };
}

/** A `Cookie` header value carrying a sealed `jmu_session` for (userId, role). */
export async function sessionCookie(userId: string, role: Role): Promise<string> {
  return `${SESSION_COOKIE}=${await sealSession({ userId, role })}`;
}
