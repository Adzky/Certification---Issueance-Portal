import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/repositories/prisma';
import type { ErrorCode } from '@/domain/errors';
import { can } from '@/domain/permissions';
import { MAX_UPLOAD_BYTES, REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import type { Role } from '@/domain/types';
import {
  decideRegistration,
  getRegistration,
  getRegistrationStatus,
  listLoginOptions,
  listRegistrations,
  loadActor,
  submitRegistration,
} from '@/services/registrations';
import { listUsers, updateAssignment } from '@/services/users';
import { listAudit } from '@/services/auditQueries';
import { readControlDocument } from '@/services/storage';
import { resetDb, seedMinimal, type Fixture } from '../setup/db';

async function expectCode(p: Promise<unknown>, code: ErrorCode, messagePart?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e as { code?: string; message?: string },
  );
  expect(err, 'expected the call to reject').not.toBeNull();
  expect(err?.code).toBe(code);
  if (messagePart) expect(err?.message).toContain(messagePart);
}

const pdf = (size = 64) => {
  const b = new Uint8Array(size);
  b.set(new TextEncoder().encode('%PDF-1.4\n'));
  return b;
};

const files = () =>
  REQUIRED_CONTROL_DOCUMENTS.map((_, i) => ({ slot: i + 1, fileName: `doc-${i + 1}.pdf`, bytes: pdf() }));

function input(over: { email?: string; role?: Role; scopes?: string[]; files?: ReturnType<typeof files> } = {}) {
  return {
    role: over.role ?? ('ISSUANCE_OFFICER' as Role),
    scopes: over.scopes ?? ['QMS', 'ISMS'],
    personal: {
      fullName: 'Rina Wijaya',
      employeeId: 'EMP-001',
      nationalId: '3174000000000001',
      position: 'Senior Auditor',
      unit: 'Certification',
      email: over.email ?? 'rina@jmu.example',
      phone: '+62 812 0000 0000',
    },
    employment: {
      education: 'S1',
      fieldOfStudy: 'Industrial Engineering',
      experienceYears: 6,
      employmentStatus: 'PERMANENT' as const,
      startDate: '2020-01-15',
    },
    declarationAccepted: true as const,
    files: over.files ?? files(),
  };
}

let f: Fixture;
let dir: string;

describe('registrations', () => {
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'jmu-storage-'));
    process.env.STORAGE_DIR = path.join(dir, 'storage');
    await resetDb();
    f = await seedMinimal();
  });
  afterEach(async () => {
    delete process.env.STORAGE_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects non-pdf and oversize uploads', async () => {
    const png = files();
    png[2] = { slot: 3, fileName: 'scan.png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) };
    await expectCode(submitRegistration(input({ files: png })), 'VALIDATION', 'Slot 3');
    expect(existsSync(path.join(dir, 'storage'))).toBe(false);

    const big = files();
    big[4] = { slot: 5, fileName: 'big.pdf', bytes: pdf(MAX_UPLOAD_BYTES + 1) };
    await expectCode(submitRegistration(input({ files: big })), 'VALIDATION', 'Slot 5');
    expect(existsSync(path.join(dir, 'storage'))).toBe(false);
    expect(await prisma.registrationApplication.count()).toBe(0);
  });

  it('missing slot is VALIDATION', async () => {
    await expectCode(submitRegistration(input({ files: files().slice(0, 6) })), 'VALIDATION', 'Slot 7');
    expect(existsSync(path.join(dir, 'storage'))).toBe(false);
  });

  it('stores the files, creates a pending user and notifies the manager', async () => {
    const { applicationId, userId } = await submitRegistration(input());
    const bytes = await readControlDocument(`registrations/${applicationId}/4.pdf`);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(await readFile(path.join(dir, 'storage', 'registrations', applicationId, '7.pdf'))).toBeTruthy();
    const a = await prisma.roleAssignment.findUniqueOrThrow({
      where: { userId_role: { userId, role: 'ISSUANCE_OFFICER' } },
    });
    expect(a.status).toBe('PENDING');
    expect(await prisma.controlDocument.count({ where: { applicationId } })).toBe(7);
    expect(await prisma.notification.count({ where: { recipientRole: 'ISSUANCE_MANAGER' } })).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'registration.submit' } });
    expect(audit.actorId).toBeNull();
    expect(audit.entityType).toBe('REGISTRATION');
    const status = await getRegistrationStatus(applicationId);
    expect(status).toMatchObject({ status: 'PENDING', assignmentStatus: 'PENDING', role: 'ISSUANCE_OFFICER' });
    expect([...status.scopes].sort()).toEqual(['ISMS', 'QMS']);
  });

  it('approval activates assignment and user appears in login options', async () => {
    const { applicationId, userId } = await submitRegistration(input());
    const before = await listLoginOptions();
    expect(before.flatMap((o) => o.users).some((u) => u.userId === userId)).toBe(false);

    const startedAt = Date.now();
    const detail = await decideRegistration(f.manager, applicationId, { decision: 'APPROVE' });
    expect(detail.status).toBe('APPROVED');
    expect(detail.assignmentStatus).toBe('ACTIVE');
    const from = new Date(detail.authorisedFrom!).getTime();
    expect(from).toBeGreaterThanOrEqual(startedAt - 1000);
    expect(new Date(detail.authorisedUntil!).getUTCFullYear()).toBe(new Date(from).getUTCFullYear() + 2);

    const opts = await listLoginOptions();
    const officers = opts.find((o) => o.role === 'ISSUANCE_OFFICER')!;
    expect(officers.users.find((u) => u.userId === userId)?.status).toBe('ACTIVE');
    const actor = await loadActor(userId, 'ISSUANCE_OFFICER');
    expect(actor).toMatchObject({ userId, role: 'ISSUANCE_OFFICER', assignmentStatus: 'ACTIVE' });
    expect([...actor!.scopeCodes].sort()).toEqual(['ISMS', 'QMS']);
    const st = await getRegistrationStatus(applicationId);
    expect(st).toMatchObject({ status: 'APPROVED', assignmentStatus: 'ACTIVE', authorisedBy: 'Test manager', userId, applicantName: 'Rina Wijaya' });
    expect(st.decisionComment).toBeUndefined();
    const a = await prisma.roleAssignment.findFirstOrThrow({ where: { userId } });
    expect(a.authorisedById).toBe(f.manager.userId);
    expect(await prisma.auditLog.count({ where: { action: 'registration.approve', actorId: f.manager.userId } })).toBe(1);

    await expectCode(decideRegistration(f.manager, applicationId, { decision: 'REJECT', comment: 'x' }), 'CONFLICT');
  });

  it('registration with existing email adds a role to that user', async () => {
    const { userId } = await submitRegistration(input({ email: 'officer@test.local', role: 'DOCUMENT_VERIFIER' }));
    expect(userId).toBe(f.officer.userId);
    expect(await prisma.user.count({ where: { email: 'officer@test.local' } })).toBe(1);
    expect(await prisma.roleAssignment.count({ where: { userId: f.officer.userId } })).toBe(2);
    // the same role again while it is active -> VALIDATION
    await expectCode(submitRegistration(input({ email: 'officer@test.local', role: 'ISSUANCE_OFFICER' })), 'VALIDATION');
  });

  it('reject requires comment and revokes the assignment', async () => {
    const { applicationId, userId } = await submitRegistration(input());
    await expectCode(decideRegistration(f.manager, applicationId, { decision: 'REJECT' }), 'VALIDATION');
    const d = await decideRegistration(f.manager, applicationId, { decision: 'REJECT', comment: 'Incomplete records' });
    expect(d.status).toBe('REJECTED');
    expect(d.decisionComment).toBe('Incomplete records');
    expect(d.assignmentStatus).toBe('REVOKED');
    expect((await loadActor(userId, 'ISSUANCE_OFFICER'))?.assignmentStatus).toBe('REVOKED');
    // a revoked applicant may re-apply
    const again = await submitRegistration(input());
    expect(again.userId).toBe(userId);
    expect((await getRegistrationStatus(again.applicationId)).assignmentStatus).toBe('PENDING');
    // the applicant sees the decision comment of a rejection, but no user id (they cannot sign in)
    const rejected = await getRegistrationStatus(applicationId);
    expect(rejected).toMatchObject({ status: 'REJECTED', decisionComment: 'Incomplete records' });
    expect(rejected.userId).toBeUndefined();
    expect((await getRegistrationStatus(again.applicationId)).userId).toBeUndefined();
  });

  it('only manager can decide', async () => {
    const { applicationId } = await submitRegistration(input());
    await expectCode(decideRegistration(f.officer, applicationId, { decision: 'APPROVE' }), 'FORBIDDEN');
    await expectCode(listRegistrations(f.officer, {}), 'FORBIDDEN');
    const list = await listRegistrations(f.manager, { status: 'PENDING' });
    expect(list.map((r) => r.id)).toEqual([applicationId]);
    expect((await getRegistration(f.manager, applicationId)).documents).toHaveLength(7);
    await expectCode(getRegistration(f.manager, 'nope'), 'NOT_FOUND');
  });

  it('an admin cannot change the status of their own assignment (self-lockout)', async () => {
    const users = await listUsers(f.admin);
    const own = users.find((u) => u.id === f.admin.userId)!.assignments[0]!;
    await expectCode(updateAssignment(f.admin, own.assignmentId, { status: 'SUSPENDED' }), 'FORBIDDEN', 'own');
    await expectCode(updateAssignment(f.admin, own.assignmentId, { status: 'REVOKED', scopeCodes: ['QMS'] }), 'FORBIDDEN');
    expect((await loadActor(f.admin.userId, 'SYSTEM_ADMIN'))?.assignmentStatus).toBe('ACTIVE');
    // other fields of one's own assignment stay editable
    await updateAssignment(f.admin, own.assignmentId, { scopeCodes: ['QMS', 'ISMS'] });
  });

  it("admin suspends a user's assignment -> loadActor returns SUSPENDED -> can() false", async () => {
    const users = await listUsers(f.admin);
    const assignment = users.find((u) => u.id === f.officer.userId)!.assignments[0];
    expect(can((await loadActor(f.officer.userId, 'ISSUANCE_OFFICER'))!, 'request.create', 'QMS')).toBe(true);
    await updateAssignment(f.admin, assignment.assignmentId, { status: 'SUSPENDED' });
    const actor = await loadActor(f.officer.userId, 'ISSUANCE_OFFICER');
    expect(actor?.assignmentStatus).toBe('SUSPENDED');
    expect(can(actor!, 'request.create', 'QMS')).toBe(false);
    await updateAssignment(f.admin, assignment.assignmentId, { status: 'ACTIVE', scopeCodes: ['QMS'] });
    expect((await loadActor(f.officer.userId, 'ISSUANCE_OFFICER'))?.scopeCodes).toEqual(['QMS']);
    await expectCode(updateAssignment(f.officer, assignment.assignmentId, { status: 'ACTIVE' }), 'FORBIDDEN');
    await expectCode(updateAssignment(f.admin, 'missing', { status: 'ACTIVE' }), 'NOT_FOUND');
    await expectCode(updateAssignment(f.admin, assignment.assignmentId, { scopeCodes: ['NOPE'] }), 'VALIDATION');
    expect(await loadActor(f.officer.userId, 'SYSTEM_ADMIN')).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'user.updateAssignment', entityType: 'USER' } })).toBe(2);
  });

  it('audit listing: viewAll sees everything, others only their own and touched entities', async () => {
    const { applicationId } = await submitRegistration(input());
    await decideRegistration(f.manager, applicationId, { decision: 'APPROVE' });
    const all = await listAudit(f.manager, {});
    expect(all.total).toBeGreaterThanOrEqual(2);
    expect(all.items.map((e) => e.action)).toContain('registration.submit');
    const byType = await listAudit(f.admin, { entityType: 'REGISTRATION', actorId: f.manager.userId });
    expect(byType.items.map((e) => e.action)).toEqual(['registration.approve']);
    expect(byType.items[0].actorName).toBe('Test manager');
    expect((await listAudit(f.officer, {})).total).toBe(0);
  });
});
