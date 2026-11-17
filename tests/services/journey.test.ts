import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/repositories/prisma';
import { VERIFICATION_CHECKLIST } from '@/domain/checklist';
import type { ErrorCode } from '@/domain/errors';
import type { DocumentType } from '@/domain/types';
import { createRequest, getRequest } from '@/services/requests';
import {
  listDocuments,
  prepareDocument,
  rejectDocument,
  returnDocument,
  signDocument,
  submitDocument,
  updateDocumentFields,
  verifyDocument,
} from '@/services/documents';
import { resetDb, seedMinimal, type Fixture } from '../setup/db';

const ALL_OK: Record<string, boolean> = Object.fromEntries(VERIFICATION_CHECKLIST.map((c) => [c.key, true]));

const FILL: Record<DocumentType, Record<string, string>> = {
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

async function expectCode(p: Promise<unknown>, code: ErrorCode | ErrorCode[]) {
  const codes = Array.isArray(code) ? code : [code];
  const err = await p.then(
    () => null,
    (e: unknown) => e as { code?: string },
  );
  expect(err, 'expected the call to reject').not.toBeNull();
  expect(codes).toContain(err?.code);
}

let f: Fixture;

async function newDraft(scopeCode = 'QMS') {
  const request = await createRequest(f.officer, {
    clientId: f.clientId,
    scopeCode,
    objectScope: 'Manufacture of steel pipes',
    priority: 'NORMAL',
  });
  const doc = await prepareDocument(f.officer, request.id);
  await updateDocumentFields(f.officer, doc.id, FILL[doc.type]);
  return { request, doc };
}

async function submitted(scopeCode = 'QMS') {
  const d = await newDraft(scopeCode);
  await submitDocument(f.officer, d.doc.id);
  return d;
}

async function readyForSigning(scopeCode = 'QMS') {
  const d = await submitted(scopeCode);
  await verifyDocument(f.verifier, d.doc.id, { checklist: ALL_OK });
  return d;
}

describe('request and document journey', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('happy path ends ISSUED', async () => {
    const { request, doc } = await readyForSigning();
    expect(doc.fields.clientName).toBe('PT Surya Kencana Industri');
    expect(doc.fields.standard).toBe('ISO 9001:2015');
    expect(doc.fields.scopeStatement).toBe('Manufacture of steel pipes');

    const { document, certificate } = await signDocument(f.signatory, doc.id);
    expect(document.status).toBe('SIGNED');
    expect(certificate.number).toMatch(/^JMU-QMS-\d{4}-0001$/);

    const detail = await getRequest(f.officer, request.id);
    expect(detail.status).toBe('ISSUED');
    expect(detail.issuedAt).not.toBeNull();
    expect(await prisma.certificate.count({ where: { requestId: request.id } })).toBe(1);
    expect(detail.timeline.map((t) => t.action)).toEqual([
      'request.create',
      'document.prepare',
      'document.edit',
      'document.submit',
      'document.verify',
      'document.sign',
    ]);
    const issueRows = await prisma.auditLog.findMany({
      where: { action: 'certificate.issue', entityType: 'CERTIFICATE', entityId: certificate.id },
    });
    expect(issueRows).toHaveLength(1);
    expect(issueRows[0].entityLabel).toBe(certificate.number);
  });

  it('return bumps version and resubmits', async () => {
    const { request, doc } = await submitted();
    const returned = await returnDocument(f.verifier, doc.id, {
      checklist: { ...ALL_OK, client_data: false },
      comment: 'Fix client address',
    });
    expect(returned.status).toBe('REVISION');
    expect(returned.version).toBe('v1.1');
    expect(returned.verifications.at(-1)?.comment).toBe('Fix client address');
    expect(returned.latestVerifierComment).toBe('Fix client address');
    expect((await getRequest(f.officer, request.id)).status).toBe('REVISION_REQUIRED');

    await updateDocumentFields(f.officer, doc.id, { clientAddress: 'Jl. Industri No. 14, Cikarang' });
    const resubmitted = await submitDocument(f.officer, doc.id);
    expect(resubmitted.status).toBe('UNDER_VERIFICATION');
    expect(resubmitted.version).toBe('v1.1');
  });

  it('return without comment is VALIDATION', async () => {
    const { doc } = await submitted();
    await expectCode(returnDocument(f.verifier, doc.id, { checklist: ALL_OK, comment: '  ' }), 'VALIDATION');
  });

  it('verify with an unchecked item is VALIDATION', async () => {
    const { doc } = await submitted();
    await expectCode(
      verifyDocument(f.verifier, doc.id, { checklist: { ...ALL_OK, impartiality: false } }),
      'VALIDATION',
    );
  });

  it('signatory reject closes the draft and allows a new one', async () => {
    const { request, doc } = await readyForSigning();
    const rejected = await rejectDocument(f.signatory, doc.id, { reason: 'Wrong standard edition' });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Wrong standard edition');
    expect((await getRequest(f.officer, request.id)).status).toBe('IN_PREPARATION');

    const second = await prepareDocument(f.officer, request.id);
    expect(second.number).not.toBe(doc.number);
    expect(second.version).toBe('v1.0');
    expect(second.status).toBe('IN_PROGRESS');

    const detail = await getRequest(f.officer, request.id);
    expect(detail.documents.map((d) => d.id).sort()).toEqual([doc.id, second.id].sort());
  });

  it('sign after reject is rejected', async () => {
    const { doc } = await readyForSigning();
    await rejectDocument(f.signatory, doc.id, { reason: 'Wrong standard edition' });
    await expectCode(signDocument(f.signatory, doc.id), ['INVALID_TRANSITION', 'CONFLICT']);
  });

  it('editing a document under verification is INVALID_TRANSITION', async () => {
    const { doc } = await submitted();
    await expectCode(updateDocumentFields(f.officer, doc.id, { sites: 'Plant 3' }), 'INVALID_TRANSITION');
  });

  it('submit with empty required field is VALIDATION', async () => {
    const request = await createRequest(f.officer, {
      clientId: f.clientId,
      scopeCode: 'QMS',
      objectScope: 'Manufacture of steel pipes',
      priority: 'HIGH',
    });
    const doc = await prepareDocument(f.officer, request.id);
    await updateDocumentFields(f.officer, doc.id, { ...FILL.CERTIFICATE, sites: '' });
    await expectCode(submitDocument(f.officer, doc.id), 'VALIDATION');
  });

  it('officer outside scope cannot create', async () => {
    await expectCode(
      createRequest(f.officer, {
        clientId: f.clientId,
        scopeCode: 'CDKAB',
        objectScope: 'Palm oil plantation',
        priority: 'NORMAL',
      }),
      'FORBIDDEN',
    );
  });

  it('verifier cannot sign', async () => {
    const { doc } = await readyForSigning();
    await expectCode(signDocument(f.verifier, doc.id), 'FORBIDDEN');
  });

  it('verification queue hides out-of-scope items', async () => {
    const qms = await submitted('QMS');
    const ins = await submitted('INS');
    expect(ins.doc.type).toBe('INSPECTION_REPORT');
    const verifier = { ...f.verifier, scopeCodes: ['QMS'] };
    const page = await listDocuments(verifier, { queue: 'verification' });
    const ids = page.items.map((d) => d.id);
    expect(ids).toContain(qms.doc.id);
    expect(ids).not.toContain(ins.doc.id);
  });

  it('submit notifies verifiers', async () => {
    await submitted();
    const rows = await prisma.notification.findMany({ where: { recipientRole: 'DOCUMENT_VERIFIER' } });
    expect(rows.length).toBeGreaterThan(0);
  });
});
