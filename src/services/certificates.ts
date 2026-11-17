import { randomBytes } from 'node:crypto';
import type { Certificate, Document, IssuanceRequest, ServiceScope } from '@prisma/client';
import type { Tx } from '@/repositories/prisma';
import { nextSequence } from '@/repositories/sequences';
import { certificateNumber, sequenceKey } from '@/domain/numbering';
import { computeValidUntil } from '@/domain/validity';

/**
 * Issues the certificate for a just-signed document (called inside the signing
 * transaction). Listing, lifecycle and public lookup are added in Task 7.
 */
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
