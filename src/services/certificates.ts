import { randomBytes } from 'node:crypto';
import type { Certificate, Document, IssuanceRequest, ServiceScope } from '@prisma/client';
import type { Tx } from '@/repositories/prisma';
import { nextSequence } from '@/repositories/sequences';
import { certificateNumber, sequenceKey } from '@/domain/numbering';
import { computeValidUntil } from '@/domain/validity';
import { prisma } from '@/repositories/prisma';
import { DomainError } from '@/domain/errors';
import { assertCan } from '@/domain/permissions';
import type { Actor, CertificateStatus } from '@/domain/types';
import { z } from 'zod';
import { recordAudit } from './audit';
import { parseInput } from './context';
import { certificateInclude, toCertificateDetail, type CertificateDetail } from './dto';

// Read side lives in certificateQueries.ts; re-exported so callers import one module.
export { getCertificate, getPublicCertificate, listCertificates } from './certificateQueries';

/** Issues the certificate for a just-signed document (called inside the signing transaction). */
export async function issueCertificate(
  tx: Tx,
  args: { request: IssuanceRequest; document: Document; scope: ServiceScope; signedAt: Date },
): Promise<Certificate> {
  const { request, document, scope, signedAt } = args;
  const year = signedAt.getUTCFullYear();
  const seq = await nextSequence(tx, sequenceKey('CERT', year, scope.schemeCode));
  const certificate = await tx.certificate.create({
    data: {
      number: certificateNumber(scope.schemeCode, year, seq),
      requestId: request.id,
      documentId: document.id,
      type: document.type,
      issueDate: signedAt,
      validUntil: computeValidUntil(signedAt, scope.termMonths),
      status: 'ACTIVE',
      verificationToken: randomBytes(16).toString('hex'),
    },
  });
  await tx.issuanceRequest.update({ where: { id: request.id }, data: { issuedAt: signedAt } });
  return certificate;
}

type Lifecycle = 'suspend' | 'reinstate' | 'revoke';

const LIFECYCLE: Record<Lifecycle, { from: CertificateStatus[]; to: CertificateStatus; verb: string }> = {
  suspend: { from: ['ACTIVE'], to: 'SUSPENDED', verb: 'suspended' },
  reinstate: { from: ['SUSPENDED'], to: 'ACTIVE', verb: 'reinstated' },
  revoke: { from: ['ACTIVE', 'SUSPENDED'], to: 'REVOKED', verb: 'revoked' },
};

const reasonSchema = z.string({ error: 'Reason is required' }).trim().min(1, 'Reason is required').max(2000);

async function changeStatus(
  actor: Actor,
  id: string,
  action: Lifecycle,
  reason: string | undefined,
): Promise<CertificateDetail> {
  const def = LIFECYCLE[action];
  await prisma.$transaction(async (tx) => {
    const cert = await tx.certificate.findUnique({ where: { id }, include: certificateInclude });
    if (!cert) throw new DomainError('NOT_FOUND', 'Certificate not found');
    assertCan(actor, `certificate.${action}`, cert.request.scopeCode);
    const comment = action === 'reinstate' ? undefined : parseInput(reasonSchema, reason);
    if (!def.from.includes(cert.status as CertificateStatus)) {
      throw new DomainError('INVALID_TRANSITION', `Certificate ${cert.number} cannot be ${def.verb} while ${cert.status}`);
    }
    const r = await tx.certificate.updateMany({
      where: { id, status: cert.status },
      data: { status: def.to, statusReason: comment ?? null },
    });
    if (r.count === 0) throw new DomainError('CONFLICT', `Certificate ${cert.number} was changed; reload and retry`);
    await recordAudit(tx, {
      actor,
      action: `certificate.${action}`,
      entityType: 'CERTIFICATE',
      entityId: cert.id,
      entityLabel: cert.number,
      comment,
    });
  });
  const c = await prisma.certificate.findUniqueOrThrow({ where: { id }, include: certificateInclude });
  return toCertificateDetail(c);
}

export const suspendCertificate = (actor: Actor, id: string, input: { reason: string }) =>
  changeStatus(actor, id, 'suspend', input?.reason);

export const reinstateCertificate = (actor: Actor, id: string) => changeStatus(actor, id, 'reinstate', undefined);

export const revokeCertificate = (actor: Actor, id: string, input: { reason: string }) =>
  changeStatus(actor, id, 'revoke', input?.reason);
