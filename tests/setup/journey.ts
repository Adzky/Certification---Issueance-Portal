import { VERIFICATION_CHECKLIST } from '@/domain/checklist';
import type { DocumentType } from '@/domain/types';
import { createRequest } from '@/services/requests';
import {
  prepareDocument,
  signDocument,
  submitDocument,
  updateDocumentFields,
  verifyDocument,
} from '@/services/documents';
import type { Fixture } from './db';

export const ALL_OK: Record<string, boolean> = Object.fromEntries(VERIFICATION_CHECKLIST.map((c) => [c.key, true]));

export const FILL: Record<DocumentType, Record<string, string>> = {
  CERTIFICATE: {
    clientAddress: 'Jl. Industri No. 12, Cikarang, Bekasi',
    sites: 'Head office and Plant 1, Cikarang',
    auditDate: '2026-11-10',
  },
  INSPECTION_REPORT: {
    inspectionLocation: 'Plant 2, Balikpapan',
    inspectionDate: '2026-11-12',
    method: 'Visual and dimensional inspection',
    findings: 'No nonconformities found',
    conclusion: 'Conforms to requirements',
  },
};

/** Creates a request and drives its document to READY_FOR_SIGNING. */
export async function driveToReadyForSigning(fx: Fixture, scopeCode = 'QMS') {
  const request = await createRequest(fx.officer, {
    clientId: fx.clientId,
    scopeCode,
    objectScope: 'Manufacture of steel pipes',
    priority: 'NORMAL',
  });
  const doc = await prepareDocument(fx.officer, request.id);
  await updateDocumentFields(fx.officer, doc.id, FILL[doc.type]);
  await submitDocument(fx.officer, doc.id);
  await verifyDocument(fx.verifier, doc.id, { checklist: ALL_OK });
  return { request, doc };
}

/** Drives a document all the way to a signed, issued certificate. */
export async function issueOne(fx: Fixture, scopeCode = 'QMS') {
  const { request, doc } = await driveToReadyForSigning(fx, scopeCode);
  const { certificate } = await signDocument(fx.signatory, doc.id);
  return { request, doc, certificate };
}
