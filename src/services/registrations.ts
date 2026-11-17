import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/repositories/prisma';
import { DomainError } from '@/domain/errors';
import { assertCan, ROLES } from '@/domain/permissions';
import { hasPdfMagic, MAX_UPLOAD_BYTES, REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import type { Actor, AuthorisationStatus, RegistrationStatus, Role } from '@/domain/types';
import { recordAudit } from './audit';
import { parseInput } from './context';
import { parseJsonRecord } from './dto';
import type { LoginOption, RegistrationDetail, RegistrationStatusInfo, RegistrationSummary } from './dtoAdmin';
import { notify } from './notifications';
import { deleteApplicationFiles, readControlDocument, saveControlDocument } from './storage';

const text = (what: string, max = 200) =>
  z.string({ error: `${what} is required` }).trim().min(1, `${what} is required`).max(max);
const dateString = (what: string) =>
  z.string({ error: `${what} is required` }).refine((v) => !Number.isNaN(Date.parse(v)), `${what} must be a valid date`);

const submitSchema = z.object({
  role: z.enum(ROLES as [Role, ...Role[]], { error: 'Role is invalid' }),
  scopes: z.array(text('Scope code')).min(1, 'Select at least one service scope'),
  personal: z.object({
    fullName: text('Full name'),
    employeeId: text('Employee ID'),
    nationalId: text('National ID'),
    position: text('Position'),
    unit: text('Unit'),
    email: z.string({ error: 'Email is required' }).trim().toLowerCase().pipe(z.email('Email is invalid')),
    phone: text('Phone'),
  }),
  employment: z.object({
    education: text('Education'),
    fieldOfStudy: text('Field of study'),
    experienceYears: z.number({ error: 'Experience (years) is required' }).min(0, 'Experience must not be negative').max(80),
    employmentStatus: z.enum(['PERMANENT', 'CONTRACT'], { error: 'Employment status is invalid' }),
    startDate: dateString('Start date'),
  }),
  declarationAccepted: z.literal(true, { error: 'The declaration must be accepted' }),
});

export interface RegistrationFileInput {
  slot: number;
  fileName: string;
  bytes: Uint8Array;
}

export interface SubmitRegistrationInput {
  role: Role;
  scopes: string[];
  personal: {
    fullName: string;
    employeeId: string;
    nationalId: string;
    position: string;
    unit: string;
    email: string;
    phone: string;
  };
  employment: {
    education: string;
    fieldOfStudy: string;
    experienceYears: number;
    employmentStatus: 'PERMANENT' | 'CONTRACT';
    startDate: string;
  };
  declarationAccepted: true;
  files: RegistrationFileInput[];
}

export const slotLabel = (slot: number): string => `Slot ${slot} (${REQUIRED_CONTROL_DOCUMENTS[slot - 1]})`;

/** Validates every slot before anything is written anywhere. */
function validateFiles(files: unknown): RegistrationFileInput[] {
  if (!Array.isArray(files)) throw new DomainError('VALIDATION', 'Control documents are required');
  const bySlot = new Map<number, RegistrationFileInput>();
  for (const file of files as RegistrationFileInput[]) {
    const slot = Number(file?.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > REQUIRED_CONTROL_DOCUMENTS.length) {
      throw new DomainError('VALIDATION', `Unknown document slot ${String(file?.slot)}`);
    }
    if (bySlot.has(slot)) throw new DomainError('VALIDATION', `${slotLabel(slot)}: uploaded more than once`);
    bySlot.set(slot, { slot, fileName: String(file.fileName ?? ''), bytes: file.bytes });
  }
  for (let slot = 1; slot <= REQUIRED_CONTROL_DOCUMENTS.length; slot++) {
    const file = bySlot.get(slot);
    if (!file || !(file.bytes instanceof Uint8Array) || file.bytes.length === 0) {
      throw new DomainError('VALIDATION', `${slotLabel(slot)}: a PDF file is required`);
    }
    if (!/\.pdf$/i.test(file.fileName) || !hasPdfMagic(file.bytes)) {
      throw new DomainError('VALIDATION', `${slotLabel(slot)}: only PDF files are accepted`);
    }
    if (file.bytes.length > MAX_UPLOAD_BYTES) {
      throw new DomainError('VALIDATION', `${slotLabel(slot)}: file exceeds the 10 MB limit`);
    }
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}

export async function submitRegistration(
  input: SubmitRegistrationInput,
): Promise<{ applicationId: string; userId: string }> {
  const data = parseInput(submitSchema, input);
  const files = validateFiles(input?.files);

  const applicationId = randomUUID();
  const stored: { slot: number; fileName: string; storagePath: string; sizeBytes: number }[] = [];
  try {
    for (const file of files) {
      stored.push({
        slot: file.slot,
        fileName: file.fileName,
        storagePath: await saveControlDocument(applicationId, file.slot, file.bytes),
        sizeBytes: file.bytes.length,
      });
    }
    const userId = await prisma.$transaction(async (tx) => {
      const scopes = await tx.serviceScope.findMany({ where: { code: { in: data.scopes } }, select: { code: true } });
      const known = new Set(scopes.map((s) => s.code));
      const unknown = data.scopes.find((c) => !known.has(c));
      if (unknown) throw new DomainError('VALIDATION', `Unknown service scope ${unknown}`);
      const scopeCodes = [...new Set(data.scopes)];

      const p = data.personal;
      const user =
        (await tx.user.findUnique({ where: { email: p.email } })) ??
        (await tx.user.create({
          data: {
            name: p.fullName,
            email: p.email,
            employeeId: p.employeeId,
            phone: p.phone,
            position: p.position,
            unit: p.unit,
          },
        }));

      const existing = await tx.roleAssignment.findUnique({ where: { userId_role: { userId: user.id, role: data.role } } });
      if (existing) {
        if (existing.status !== 'REVOKED' && existing.status !== 'EXPIRED') {
          throw new DomainError('VALIDATION', 'This user already holds, or has applied for, this role');
        }
        await tx.roleAssignment.update({
          where: { id: existing.id },
          data: { status: 'PENDING', authorisedFrom: null, authorisedUntil: null, authorisedById: null },
        });
        await tx.roleAssignmentScope.deleteMany({ where: { assignmentId: existing.id } });
      } else {
        await tx.roleAssignment.create({ data: { userId: user.id, role: data.role, status: 'PENDING' } });
      }

      const app = await tx.registrationApplication.create({
        data: {
          id: applicationId,
          userId: user.id,
          role: data.role,
          requestedScopes: JSON.stringify(scopeCodes),
          status: 'PENDING',
          personalJson: JSON.stringify(p),
          employmentJson: JSON.stringify(data.employment),
          declarationAccepted: true,
          documents: { create: stored },
        },
      });
      await recordAudit(tx, {
        action: 'registration.submit',
        entityType: 'REGISTRATION',
        entityId: app.id,
        entityLabel: `${p.fullName} (${data.role})`,
      });
      await notify(tx, {
        recipientRole: 'ISSUANCE_MANAGER',
        message: `New authorisation request from ${p.fullName} (${data.role})`,
        link: `/authorisations?select=${app.id}`,
      });
      return user.id;
    });
    return { applicationId, userId };
  } catch (e) {
    await deleteApplicationFiles(applicationId).catch(() => undefined);
    if ((e as { code?: string })?.code === 'P2002') {
      throw new DomainError('VALIDATION', 'This user already holds, or has applied for, this role');
    }
    throw e;
  }
}

// ---------- reads ----------

const appInclude = {
  user: { select: { name: true, email: true } },
  documents: { orderBy: { slot: 'asc' } },
} satisfies Prisma.RegistrationApplicationInclude;
type AppRow = Prisma.RegistrationApplicationGetPayload<{ include: typeof appInclude }>;

const parseArray = (json: string): string[] => {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

function toSummary(a: AppRow): RegistrationSummary {
  const personal = parseJsonRecord<string>(a.personalJson);
  return {
    id: a.id,
    userId: a.userId,
    applicantName: personal.fullName ?? a.user.name,
    email: a.user.email,
    role: a.role as Role,
    requestedScopes: parseArray(a.requestedScopes),
    status: a.status as RegistrationStatus,
    createdAt: a.createdAt.toISOString(),
    decidedAt: a.decidedAt?.toISOString() ?? null,
  };
}

async function loadDetail(db: Tx, id: string): Promise<RegistrationDetail> {
  const a = await db.registrationApplication.findUnique({ where: { id }, include: appInclude });
  if (!a) throw new DomainError('NOT_FOUND', 'Registration not found');
  const [assignment, decider] = await Promise.all([
    db.roleAssignment.findUnique({ where: { userId_role: { userId: a.userId, role: a.role } } }),
    a.decidedById ? db.user.findUnique({ where: { id: a.decidedById }, select: { name: true } }) : null,
  ]);
  return {
    ...toSummary(a),
    personal: parseJsonRecord<string>(a.personalJson) as unknown as RegistrationDetail['personal'],
    employment: JSON.parse(a.employmentJson) as RegistrationDetail['employment'],
    declarationAccepted: a.declarationAccepted,
    documents: a.documents.map((d) => ({
      slot: d.slot,
      name: REQUIRED_CONTROL_DOCUMENTS[d.slot - 1] ?? `Document ${d.slot}`,
      fileName: d.fileName,
      sizeBytes: d.sizeBytes,
    })),
    decisionComment: a.decisionComment,
    decidedById: a.decidedById,
    decidedByName: decider?.name ?? null,
    assignmentStatus: (assignment?.status as AuthorisationStatus | undefined) ?? null,
    authorisedFrom: assignment?.authorisedFrom?.toISOString() ?? null,
    authorisedUntil: assignment?.authorisedUntil?.toISOString() ?? null,
  };
}

export async function listRegistrations(actor: Actor, q: { status?: RegistrationStatus } = {}): Promise<RegistrationSummary[]> {
  assertCan(actor, 'registration.decide');
  const rows = await prisma.registrationApplication.findMany({
    where: q.status ? { status: q.status } : {},
    include: appInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toSummary);
}

export async function getRegistration(actor: Actor, id: string): Promise<RegistrationDetail> {
  assertCan(actor, 'registration.decide');
  return loadDetail(prisma, id);
}

/** One uploaded control document (slot 1..7) of an application, for the manager's review. */
export async function getRegistrationFile(
  actor: Actor,
  id: string,
  slot: string,
): Promise<{ fileName: string; bytes: Uint8Array }> {
  assertCan(actor, 'registration.decide');
  const n = /^\d+$/.test(slot) ? Number(slot) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > REQUIRED_CONTROL_DOCUMENTS.length) {
    throw new DomainError('VALIDATION', `Unknown document slot ${slot}`);
  }
  const doc = await prisma.controlDocument.findFirst({ where: { applicationId: String(id ?? ''), slot: n } });
  if (!doc) throw new DomainError('NOT_FOUND', 'Document not found');
  try {
    return { fileName: doc.fileName, bytes: await readControlDocument(doc.storagePath) };
  } catch {
    throw new DomainError('NOT_FOUND', 'Document not found');
  }
}

const decideSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT'], { error: 'Decision must be APPROVE or REJECT' }),
  comment: z.string().trim().max(2000).optional(),
  authorisedUntil: dateString('Authorised until').optional(),
});

export async function decideRegistration(
  actor: Actor,
  id: string,
  input: { decision: 'APPROVE' | 'REJECT'; comment?: string; authorisedUntil?: string },
): Promise<RegistrationDetail> {
  assertCan(actor, 'registration.decide');
  const data = parseInput(decideSchema, input);
  if (data.decision === 'REJECT' && !data.comment) throw new DomainError('VALIDATION', 'A comment is required to reject');
  const now = new Date();
  let until: Date | undefined;
  if (data.decision === 'APPROVE') {
    until = data.authorisedUntil ? new Date(data.authorisedUntil) : new Date(now);
    if (!data.authorisedUntil) until.setUTCFullYear(until.getUTCFullYear() + 2);
    if (until.getTime() <= now.getTime()) throw new DomainError('VALIDATION', 'Authorised until must be in the future');
  }

  await prisma.$transaction(async (tx) => {
    const app = await tx.registrationApplication.findUnique({ where: { id } });
    if (!app) throw new DomainError('NOT_FOUND', 'Registration not found');
    const approve = data.decision === 'APPROVE';
    const claimed = await tx.registrationApplication.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        decidedById: actor.userId,
        decidedAt: now,
        decisionComment: data.comment || null,
      },
    });
    if (claimed.count === 0) throw new DomainError('CONFLICT', 'This registration has already been decided');

    const assignment = await tx.roleAssignment.findUnique({ where: { userId_role: { userId: app.userId, role: app.role } } });
    if (!assignment) throw new DomainError('CONFLICT', 'Role assignment no longer exists');
    if (approve) {
      await tx.roleAssignmentScope.deleteMany({ where: { assignmentId: assignment.id } });
      await tx.roleAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'ACTIVE',
          authorisedFrom: now,
          authorisedUntil: until,
          authorisedById: actor.userId,
          scopes: { create: parseArray(app.requestedScopes).map((scopeCode) => ({ scopeCode })) },
        },
      });
    } else {
      await tx.roleAssignment.update({ where: { id: assignment.id }, data: { status: 'REVOKED' } });
    }
    const personal = parseJsonRecord<string>(app.personalJson);
    const label = `${personal.fullName ?? 'Applicant'} (${app.role})`;
    await recordAudit(tx, {
      actor,
      action: approve ? 'registration.approve' : 'registration.reject',
      entityType: 'REGISTRATION',
      entityId: id,
      entityLabel: label,
      comment: data.comment || undefined,
    });
    await notify(tx, {
      recipientUserId: app.userId,
      message: approve
        ? `Your authorisation as ${app.role} was approved`
        : `Your authorisation request as ${app.role} was rejected: ${data.comment}`,
    });
  });
  return loadDetail(prisma, id);
}

/** Public: lets an applicant follow their registration (onboarding step 4). */
export async function getRegistrationStatus(applicationId: string): Promise<RegistrationStatusInfo> {
  const app = await prisma.registrationApplication.findUnique({ where: { id: String(applicationId ?? '') } });
  if (!app) throw new DomainError('NOT_FOUND', 'Registration not found');
  const assignment = await prisma.roleAssignment.findUnique({
    where: { userId_role: { userId: app.userId, role: app.role } },
    include: { scopes: true },
  });
  const authoriser = assignment?.authorisedById
    ? await prisma.user.findUnique({ where: { id: assignment.authorisedById }, select: { name: true } })
    : null;
  return {
    status: app.status as RegistrationStatus,
    assignmentStatus: (assignment?.status as AuthorisationStatus | undefined) ?? 'PENDING',
    role: app.role as Role,
    scopes:
      app.status === 'APPROVED' && assignment?.scopes.length
        ? assignment.scopes.map((s) => s.scopeCode).sort()
        : parseArray(app.requestedScopes),
    ...(assignment?.authorisedFrom ? { authorisedFrom: assignment.authorisedFrom.toISOString() } : {}),
    ...(assignment?.authorisedUntil ? { authorisedUntil: assignment.authorisedUntil.toISOString() } : {}),
    ...(authoriser ? { authorisedBy: authoriser.name } : {}),
    applicantName: parseJsonRecord<string>(app.personalJson).fullName ?? undefined,
    ...(app.status === 'APPROVED' ? { userId: app.userId } : {}),
    ...(app.status === 'REJECTED' && app.decisionComment ? { decisionComment: app.decisionComment } : {}),
  };
}

// ---------- login ----------

export async function listLoginOptions(): Promise<LoginOption[]> {
  const rows = await prisma.roleAssignment.findMany({
    where: { status: { in: ['ACTIVE', 'RESTRICTED'] } },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return ROLES.map((role) => ({
    role,
    users: rows
      .filter((r) => r.role === role)
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
      .map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        ...(r.user.avatarUrl ? { avatarUrl: r.user.avatarUrl } : {}),
        status: r.status as AuthorisationStatus,
      })),
  })).filter((o) => o.users.length > 0);
}

/** Loads the actor for (user, role) with its current authorisation status; null if no such assignment. */
export async function loadActor(userId: string, role: Role): Promise<Actor | null> {
  const a = await prisma.roleAssignment.findUnique({
    where: { userId_role: { userId, role } },
    include: { scopes: true },
  });
  if (!a) return null;
  return {
    userId,
    role,
    assignmentStatus: a.status as AuthorisationStatus,
    scopeCodes: a.scopes.map((s) => s.scopeCode).sort(),
  };
}
