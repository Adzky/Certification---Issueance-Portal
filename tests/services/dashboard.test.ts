import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/repositories/prisma';
import { createRequest } from '@/services/requests';
import { prepareDocument, returnDocument, submitDocument, updateDocumentFields } from '@/services/documents';
import { getDashboard } from '@/services/dashboard';
import { resetDb, seedMinimal, type Fixture } from '../setup/db';
import { driveToReadyForSigning, FILL, issueOne } from '../setup/journey';

let f: Fixture;
const stat = (d: { stats: { key: string; value: number }[] }, key: string) => d.stats.find((s) => s.key === key)?.value;

describe('dashboard', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('manager dashboard counts match seeded fixture', async () => {
    const issued = await issueOne(f, 'QMS'); // ISSUED, on time
    const late = await issueOne(f, 'ISMS'); // ISSUED, made late below
    await prisma.issuanceRequest.update({
      where: { id: late.request.id },
      data: { dueDate: new Date(Date.now() - 3 * 86_400_000) },
    });
    await driveToReadyForSigning(f, 'CE'); // READY_FOR_SIGNING, due in 7 working days
    await createRequest(f.officer, { clientId: f.clientId, scopeCode: 'INS', objectScope: 'Pressure vessels', priority: 'HIGH' });
    const rev = await createRequest(f.officer, { clientId: f.clientId, scopeCode: 'QMS', objectScope: 'x', priority: 'LOW' });
    const rd = await prepareDocument(f.officer, rev.id);
    await updateDocumentFields(f.officer, rd.id, FILL[rd.type]);
    await submitDocument(f.officer, rd.id);
    await returnDocument(f.verifier, rd.id, { checklist: {}, comment: 'Fix it' });

    const d = await getDashboard(f.manager, new Date());
    expect(d.role).toBe('ISSUANCE_MANAGER');
    expect(stat(d, 'total')).toBe(5);
    expect(stat(d, 'issued')).toBe(2);
    expect(stat(d, 'inProgress')).toBe(1);
    expect(stat(d, 'needsAction')).toBe(1);
    expect(stat(d, 'dueSoon')).toBeGreaterThanOrEqual(1);
    expect(d.sla).toEqual({ achievedPct: 50, targetPct: 90 });
    expect(d.trend).toHaveLength(5);
    expect(d.trend![4]).toMatchObject({ issued: 2, requested: 5 });
    expect(d.statusBreakdown!.reduce((n, s) => n + s.count, 0)).toBe(5);
    expect(d.queue.length).toBeLessThanOrEqual(5);
    expect(d.queue.every((q) => q.link.startsWith('/requests?select='))).toBe(true);
    expect(d.queue.map((q) => q.id)).not.toContain(issued.request.id);
  });

  it('manager stats, donut and queue are period-based (R15)', async () => {
    await createRequest(f.officer, { clientId: f.clientId, scopeCode: 'INS', objectScope: 'new', priority: 'NORMAL' });
    const old = await createRequest(f.officer, { clientId: f.clientId, scopeCode: 'QMS', objectScope: 'old', priority: 'HIGH' });
    await prisma.issuanceRequest.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 60 * 86_400_000), dueDate: new Date(Date.now() - 40 * 86_400_000) },
    });
    const now = new Date();
    const d30 = await getDashboard(f.manager, now);
    expect(stat(d30, 'total')).toBe(1);
    expect(d30.statusBreakdown!.reduce((n, s) => n + s.count, 0)).toBe(1);
    expect(d30.queue.map((q) => q.id)).not.toContain(old.id);
    const d90 = await getDashboard(f.manager, now, { periodDays: 90 });
    expect(stat(d90, 'total')).toBe(2);
    expect(d90.queue.map((q) => q.id)).toContain(old.id);
    const d7 = await getDashboard(f.manager, now, { periodDays: 7 });
    expect(stat(d7, 'total')).toBe(1);
    // Other roles ignore the option.
    expect((await getDashboard(f.officer, now, { periodDays: 90 })).stats).toHaveLength(4);
  });

  it('role dashboards expose their stats and queue links', async () => {
    const { doc } = await driveToReadyForSigning(f, 'QMS');
    const s = await getDashboard(f.signatory, new Date());
    expect(stat(s, 'readyToSign')).toBe(1);
    expect(s.queue[0].link).toBe(`/signing?select=${doc.id}`);
    const v = await getDashboard(f.verifier, new Date());
    expect(stat(v, 'verified')).toBe(1);
    expect(stat(v, 'awaiting')).toBe(0);
    const o = await getDashboard(f.officer, new Date());
    expect(o.stats.map((x) => x.label)).toEqual(['My Tasks', 'Draft', 'In Revision', 'Ready for Verification']);
    const a = await getDashboard(f.admin, new Date());
    expect(a.stats.find((x) => x.key === 'uptime')).toEqual({ key: 'uptime', label: 'Uptime', value: 99.9, tone: 'green' });
    expect(stat(a, 'users')).toBe(5);
    expect(a.recentActivity!.length).toBeGreaterThan(0);
  });
});
