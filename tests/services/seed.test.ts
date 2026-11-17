import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/repositories/prisma';
import { resolveDbUrl } from '@/repositories/db-url';
import { truncateAll } from '@/repositories/truncate';
import { displayCertificateStatus } from '@/domain/validity';
import { nextState } from '@/domain/workflow';
import type { DocumentStatus, RequestStatus, Role, WorkflowEvent } from '@/domain/types';
import { getDashboard } from '@/services/dashboard';
import { listRequests } from '@/services/requests';
import { listCertificates } from '@/services/certificates';
import { listRegistrations, loadActor } from '@/services/registrations';
import { seed } from '../../prisma/seed';

const NOW = new Date('2026-11-17T09:00:00Z');
const ROOT = path.resolve(__dirname, '..', '..');

const DEMO: { email: string; role: Role }[] = [
  { email: 'andi.pratama@jmu.co.id', role: 'ISSUANCE_OFFICER' },
  { email: 'dewi.lestari@jmu.co.id', role: 'DOCUMENT_VERIFIER' },
  { email: 'budi.santoso@jmu.co.id', role: 'AUTHORISED_SIGNATORY' },
  { email: 'rina.wulandari@jmu.co.id', role: 'ISSUANCE_MANAGER' },
  { email: 'fajar.hidayat@jmu.co.id', role: 'SYSTEM_ADMIN' },
];

/** The "To" column of the workflow table, plus the initial SUBMITTED/none state. */
function reachableStates(): Set<string> {
  const from: [RequestStatus, DocumentStatus | null][] = [
    ['SUBMITTED', null],
    ['IN_PREPARATION', 'REJECTED'],
    ['IN_PREPARATION', 'IN_PROGRESS'],
    ['REVISION_REQUIRED', 'REVISION'],
    ['IN_VERIFICATION', 'UNDER_VERIFICATION'],
    ['READY_FOR_SIGNING', 'READY_FOR_SIGNING'],
  ];
  const events: WorkflowEvent[] = ['PREPARE', 'SUBMIT', 'APPROVE', 'RETURN', 'SIGN', 'REJECT'];
  const out = new Set<string>(['SUBMITTED/NONE']);
  for (const [request, document] of from) {
    for (const ev of events) {
      try {
        const n = nextState({ request, document }, ev);
        out.add(`${n.request}/${n.document ?? 'NONE'}`);
      } catch {
        /* event not valid from this state */
      }
    }
  }
  return out;
}

async function actorFor(email: string, role: Role) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return (await loadActor(user.id, role))!;
}

describe('seed', () => {
  let storage: string;
  beforeAll(async () => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-storage-'));
    process.env.STORAGE_DIR = storage;
    await truncateAll(prisma);
    await seed(prisma, NOW);
  }, 300_000);
  afterAll(() => {
    delete process.env.STORAGE_DIR;
    fs.rmSync(storage, { recursive: true, force: true });
  });

  it('seed obeys the state machine', async () => {
    const reqs = await prisma.issuanceRequest.findMany({ include: { documents: true, certificate: true } });
    expect(reqs.length).toBeGreaterThanOrEqual(100);
    const reachable = reachableStates();
    for (const r of reqs) {
      const live = r.documents.find((d) => d.status !== 'REJECTED') ?? r.documents[0] ?? null;
      expect(reachable.has(`${r.status}/${live?.status ?? 'NONE'}`), `${r.number} ${r.status}/${live?.status}`).toBe(true);
      expect(r.documents.filter((d) => d.status !== 'REJECTED').length).toBeLessThanOrEqual(1);
      if (r.status === 'ISSUED') expect(r.certificate, r.number).not.toBeNull();
      else expect(r.certificate, r.number).toBeNull();
    }
    const issued = reqs.filter((r) => r.status === 'ISSUED');
    const certCount = await prisma.certificate.count();
    expect(certCount).toBe(issued.length);
    expect(certCount).toBeGreaterThanOrEqual(400);
    expect(certCount).toBeLessThanOrEqual(500);
  });

  it('has the demo users, 42 users total, and the volumes the brief asks for', async () => {
    expect(await prisma.user.count()).toBe(42);
    for (const d of DEMO) {
      const u = await prisma.user.findUnique({
        where: { email: d.email },
        include: { roleAssignments: { include: { scopes: true } } },
      });
      expect(u, d.email).not.toBeNull();
      const a = u!.roleAssignments.find((x) => x.role === d.role);
      expect(a?.status).toBe('ACTIVE');
      expect(u!.avatarUrl).toBeNull();
      if (d.email.startsWith('andi')) {
        expect(a!.scopes.map((s) => s.scopeCode).sort()).toEqual(['CE', 'INS', 'ISMS', 'QMS']);
      }
    }
    const recent = await prisma.issuanceRequest.count({
      where: { createdAt: { gte: new Date(NOW.getTime() - 61 * 86_400_000) } },
    });
    expect(recent).toBeGreaterThanOrEqual(110);
    expect(recent).toBeLessThanOrEqual(130);

    const certs = await prisma.certificate.findMany();
    const by = (s: string) => certs.filter((c) => c.status === s).length;
    expect(by('SUSPENDED')).toBe(8);
    expect(by('REVOKED')).toBe(4);
    expect(by('IN_RENEWAL')).toBe(12);
    const display = certs.map((c) =>
      displayCertificateStatus({ status: c.status as never, validUntil: c.validUntil }, NOW),
    );
    expect(display).toContain('EXPIRING');
    expect(display).toContain('EXPIRED');
    expect(certs.every((c) => c.issueDate <= NOW)).toBe(true);

    const manager = await actorFor(DEMO[3].email, 'ISSUANCE_MANAGER');
    expect(await listRegistrations(manager, { status: 'PENDING' })).toHaveLength(1);
    expect(await prisma.controlDocument.count()).toBe(7);
    expect(fs.readdirSync(path.join(storage, 'registrations')).length).toBe(1);
    const flagged = await prisma.user.count({
      where: { roleAssignments: { some: { status: { in: ['SUSPENDED', 'RESTRICTED'] } } } },
    });
    expect(flagged).toBeGreaterThanOrEqual(3);
  });

  it('manager dashboard SLA over the trend window meets the 90% target on a fresh seed', async () => {
    const manager = await actorFor(DEMO[3].email, 'ISSUANCE_MANAGER');
    const dash = await getDashboard(manager, NOW);
    expect(dash.sla?.achievedPct).toBeGreaterThanOrEqual(90);
    expect(dash.sla?.achievedPct).toBeLessThanOrEqual(95);
  });

  it('every demo role has work on first login', async () => {
    for (const d of DEMO) {
      const dash = await getDashboard(await actorFor(d.email, d.role), NOW);
      if (d.role === 'SYSTEM_ADMIN') expect(dash.recentActivity?.length ?? 0, d.role).toBeGreaterThan(0);
      else expect(dash.queue.length, d.role).toBeGreaterThan(0);
    }
    const andi = await actorFor(DEMO[0].email, 'ISSUANCE_OFFICER');
    expect((await listRequests(andi, { status: 'SUBMITTED' })).total).toBeGreaterThanOrEqual(2);
    const submitted = await prisma.issuanceRequest.findMany({
      where: { assigneeId: andi.userId, status: 'SUBMITTED' },
    });
    expect(submitted.length).toBeGreaterThanOrEqual(2);
    expect(submitted.some((r) => r.priority === 'HIGH')).toBe(true);
    expect(
      await prisma.issuanceRequest.count({ where: { assigneeId: andi.userId, status: 'REVISION_REQUIRED' } }),
    ).toBeGreaterThanOrEqual(1);
    expect(await prisma.document.count({ where: { status: 'UNDER_VERIFICATION' } })).toBeGreaterThanOrEqual(3);
    expect(await prisma.document.count({ where: { status: 'READY_FOR_SIGNING' } })).toBeGreaterThanOrEqual(3);
    const manager = await actorFor(DEMO[3].email, 'ISSUANCE_MANAGER');
    expect((await listCertificates(manager, { pageSize: 5 })).total).toBeGreaterThan(400);
  });
});

describe('seeded SLA does not depend on the weekday the seed runs on', () => {
  let storage: string;
  beforeAll(() => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-sla-'));
    process.env.STORAGE_DIR = storage;
  });
  afterAll(() => {
    delete process.env.STORAGE_DIR;
    fs.rmSync(storage, { recursive: true, force: true });
  });

  it('manager SLA is within 90-95% for seven consecutive run dates (every weekday)', async () => {
    const seen: number[] = [];
    for (let k = 0; k < 7; k++) {
      const now = new Date(NOW.getTime() + k * 86_400_000);
      await truncateAll(prisma);
      await seed(prisma, now);
      const manager = await actorFor(DEMO[3].email, 'ISSUANCE_MANAGER');
      const pct = (await getDashboard(manager, now)).sla!.achievedPct;
      seen.push(pct);
      expect(pct, `${now.toUTCString()} -> ${seen.join(',')}`).toBeGreaterThanOrEqual(90);
      expect(pct, `${now.toUTCString()} -> ${seen.join(',')}`).toBeLessThanOrEqual(95);
    }
  }, 900_000);
});

describe('ensure-db', () => {
  const dbFile = path.join(ROOT, 'prisma', 'ensure-test.db');
  const clean = () => {
    for (const s of ['', '-journal', '-wal', '-shm']) fs.rmSync(dbFile + s, { force: true });
  };
  let storage: string;
  const run = () => {
    const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'ensure-db.mjs')], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: 'file:./ensure-test.db', STORAGE_DIR: storage },
      encoding: 'utf8',
    });
    if (res.status !== 0) throw new Error(`ensure-db failed:\n${res.stdout}\n${res.stderr}`);
  };
  // SQL runs in a child process so no SQLite handle stays open in this worker (Windows would then refuse to delete the file).
  const sql = (statement: string): number => {
    const res = spawnSync(
      process.execPath,
      [
        '-e',
        "const { createClient } = require('@libsql/client'); const c = createClient({ url: process.env.COUNT_URL }); c.execute(process.env.STMT).then((r) => { console.log(r.rows[0] ? Object.values(r.rows[0])[0] : 0); c.close(); });",
      ],
      { cwd: ROOT, env: { ...process.env, COUNT_URL: resolveDbUrl('file:./ensure-test.db'), STMT: statement }, encoding: 'utf8' },
    );
    return Number(res.stdout.trim());
  };
  const userCount = (): number => sql('select count(*) from User');
  const marker = (): number => sql("select count(*) from NumberSequence where key = '__seed_complete__'");

  beforeAll(() => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-storage-'));
    clean();
  });
  afterAll(() => {
    clean();
    fs.rmSync(storage, { recursive: true, force: true });
  });

  it('ensure-db is idempotent', () => {
    run();
    const first = userCount();
    expect(first).toBe(42);
    expect(marker()).toBe(1);
    run(); // completed DB: migrate only, no reseed
    expect(userCount()).toBe(first);
    clean();
    run(); // missing DB: seeded again
    expect(userCount()).toBe(first);
  }, 400_000);

  it('ensure-db reseeds a half-seeded DB (no completion marker) and then leaves it alone', () => {
    clean();
    run();
    // Simulate an interrupted first seed: users exist, but the last step never ran.
    sql("delete from NumberSequence where key = '__seed_complete__'");
    sql('delete from Certificate');
    expect(marker()).toBe(0);
    expect(sql('select count(*) from Certificate')).toBe(0);
    run();
    expect(userCount()).toBe(42);
    expect(sql('select count(*) from Certificate')).toBe(450);
    expect(marker()).toBe(1);
    sql("insert into Client (id, name) values ('sentinel', 'PT Sentinel')");
    run(); // marker present: untouched
    expect(sql("select count(*) from Client where id = 'sentinel'")).toBe(1);
  }, 400_000);
});
