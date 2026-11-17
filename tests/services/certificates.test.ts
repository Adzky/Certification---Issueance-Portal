import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/repositories/prisma';
import type { ErrorCode } from '@/domain/errors';
import { verificationUrl } from '@/domain/verification';
import { signDocument } from '@/services/documents';
import {
  getCertificate,
  getPublicCertificate,
  listCertificates,
  reinstateCertificate,
  revokeCertificate,
  suspendCertificate,
} from '@/services/certificates';
import { getReference } from '@/services/reference';
import { resetDb, seedMinimal, type Fixture } from '../setup/db';
import { driveToReadyForSigning, issueOne } from '../setup/journey';

async function expectCode(p: Promise<unknown>, code: ErrorCode | ErrorCode[]) {
  const codes = Array.isArray(code) ? code : [code];
  const err = await p.then(
    () => null,
    (e: unknown) => e as { code?: string },
  );
  expect(err, 'expected the call to reject').not.toBeNull();
  expect(codes).toContain(err?.code);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

let f: Fixture;

describe('certificates', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('signing issues JMU-QMS-<year>-0001 valid 36 months minus a day', async () => {
    const { certificate } = await issueOne(f, 'QMS');
    const year = new Date().getUTCFullYear();
    expect(certificate.number).toBe(`JMU-QMS-${year}-0001`);
    const i = new Date(certificate.issueDate);
    const expected = new Date(Date.UTC(i.getUTCFullYear() + 3, i.getUTCMonth(), i.getUTCDate()) - DAY);
    expect(certificate.validUntil.slice(0, 10)).toBe(ymd(expected));
    expect(certificate.status).toBe('ACTIVE');
    expect(certificate.verificationToken).toMatch(/^[0-9a-f]{32}$/);
  });

  it('inspection report gets JMU-INS number and 12-month validity', async () => {
    const { certificate } = await issueOne(f, 'INS');
    expect(certificate.number).toMatch(/^JMU-INS-\d{4}-0001$/);
    expect(certificate.type).toBe('INSPECTION_REPORT');
    const i = new Date(certificate.issueDate);
    const expected = new Date(Date.UTC(i.getUTCFullYear() + 1, i.getUTCMonth(), i.getUTCDate()) - DAY);
    expect(certificate.validUntil.slice(0, 10)).toBe(ymd(expected));
  });

  it('double sign issues one certificate', async () => {
    const { doc } = await driveToReadyForSigning(f);
    const results = await Promise.allSettled([signDocument(f.signatory, doc.id), signDocument(f.signatory, doc.id)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(['CONFLICT', 'INVALID_TRANSITION']).toContain((bad[0].reason as { code?: string }).code);
    expect(await prisma.certificate.count()).toBe(1);
  });

  it('manager suspends, reinstates, revokes', async () => {
    const { certificate } = await issueOne(f);
    const s = await suspendCertificate(f.manager, certificate.id, { reason: 'Surveillance audit failed' });
    expect(s.status).toBe('SUSPENDED');
    expect(s.statusReason).toBe('Surveillance audit failed');
    const r = await reinstateCertificate(f.manager, certificate.id);
    expect(r.status).toBe('ACTIVE');
    const v = await revokeCertificate(f.manager, certificate.id, { reason: 'Fraudulent data' });
    expect(v.status).toBe('REVOKED');
    expect(v.statusReason).toBe('Fraudulent data');
    const rows = await prisma.auditLog.findMany({
      where: { entityType: 'CERTIFICATE', entityId: certificate.id },
      orderBy: { at: 'asc' },
    });
    expect(rows.map((x) => x.action)).toEqual([
      'certificate.issue',
      'certificate.suspend',
      'certificate.reinstate',
      'certificate.revoke',
    ]);
    expect(rows[1].comment).toBe('Surveillance audit failed');
  });

  it('revoked cannot be reinstated', async () => {
    const { certificate } = await issueOne(f);
    await revokeCertificate(f.manager, certificate.id, { reason: 'Fraudulent data' });
    await expectCode(reinstateCertificate(f.manager, certificate.id), 'INVALID_TRANSITION');
    await expectCode(suspendCertificate(f.manager, certificate.id, { reason: 'x' }), 'INVALID_TRANSITION');
  });

  it('officer cannot suspend', async () => {
    const { certificate } = await issueOne(f);
    await expectCode(suspendCertificate(f.officer, certificate.id, { reason: 'x' }), 'FORBIDDEN');
  });

  it('suspend without reason is VALIDATION', async () => {
    const { certificate } = await issueOne(f);
    await expectCode(suspendCertificate(f.manager, certificate.id, { reason: '  ' }), 'VALIDATION');
    await expectCode(revokeCertificate(f.manager, certificate.id, { reason: '' }), 'VALIDATION');
  });

  it('public lookup returns display status and no internal ids', async () => {
    const { certificate } = await issueOne(f);
    const pub = await getPublicCertificate(certificate.number);
    expect(pub).not.toBeNull();
    expect(Object.keys(pub!).sort()).toEqual(
      ['clientName', 'displayStatus', 'issueDate', 'number', 'schemeLabel', 'scopeName', 'type', 'validUntil'].sort(),
    );
    expect(pub!.displayStatus).toBe('ACTIVE');
    expect(await getPublicCertificate('JMU-QMS-1999-9999')).toBeNull();
  });

  it('lists with stats, scheme filter and scope restriction; reads detail', async () => {
    const a = await issueOne(f, 'QMS');
    await issueOne(f, 'INS');
    await suspendCertificate(f.manager, a.certificate.id, { reason: 'Audit' });
    const all = await listCertificates(f.manager, {});
    expect(all.total).toBe(2);
    expect(all.stats.TOTAL).toBe(2);
    expect(all.stats.SUSPENDED).toBe(1);
    expect(all.stats.ACTIVE).toBe(1);
    const susp = await listCertificates(f.manager, { status: 'SUSPENDED' });
    expect(susp.items.map((c) => c.id)).toEqual([a.certificate.id]);
    expect((await listCertificates(f.manager, { scheme: 'INS' })).items).toHaveLength(1);
    expect((await listCertificates({ ...f.officer, scopeCodes: ['QMS'] }, {})).total).toBe(1);
    const d = await getCertificate(f.manager, a.certificate.id);
    expect(d.number).toBe(a.certificate.number);
    await expectCode(getCertificate({ ...f.officer, scopeCodes: ['INS'] }, a.certificate.id), 'NOT_FOUND');
  });

  it('expired certificates show as EXPIRED', async () => {
    const { certificate } = await issueOne(f);
    await prisma.certificate.update({ where: { id: certificate.id }, data: { validUntil: new Date(Date.now() - 3 * DAY) } });
    const page = await listCertificates(f.manager, {});
    expect(page.stats.EXPIRED).toBe(1);
    expect(page.stats.ACTIVE).toBe(0);
    expect((await listCertificates(f.manager, { status: 'EXPIRED' })).total).toBe(1);
  });

  it('verificationUrl and getReference', async () => {
    expect(verificationUrl('JMU-QMS-2026-0001', 'http://x.test')).toBe('http://x.test/verify/JMU-QMS-2026-0001');
    const ref = await getReference();
    expect(ref.clients.map((c) => c.name)).toEqual(['PT Surya Kencana Industri']);
    expect(ref.scopes.map((s) => s.code)).toEqual(['CDKAB', 'CE', 'INS', 'ISMS', 'QMS']);
    expect(ref.checklist.length).toBeGreaterThan(0);
  });
});

describe('audit entityId filter', () => {
  it('lists only the entries of one entity', async () => {
    await resetDb();
    const f = await seedMinimal();
    const a = await issueOne(f);
    const b = await issueOne(f);
    await suspendCertificate(f.manager, a.certificate.id, { reason: 'Client audit overdue' });
    const { listAudit } = await import('@/services/auditQueries');
    const rows = await listAudit(f.manager, { entityType: 'CERTIFICATE', entityId: a.certificate.id });
    expect(rows.items.map((x) => x.action).sort()).toEqual(['certificate.issue', 'certificate.suspend']);
    expect(rows.items.every((x) => x.entityId === a.certificate.id)).toBe(true);
    const other = await listAudit(f.manager, { entityType: 'CERTIFICATE', entityId: b.certificate.id });
    expect(other.total).toBe(1);
  });
});
