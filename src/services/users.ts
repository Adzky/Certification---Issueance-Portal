import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/repositories/prisma';
import { DomainError } from '@/domain/errors';
import { assertCan, isAssignmentCurrentlyUsable, ROLE_ACTIONS, ROLES } from '@/domain/permissions';
import type { Actor, AuthorisationStatus, Role } from '@/domain/types';
import { recordAudit } from './audit';
import { parseInput } from './context';
import type { UserSummary } from './dtoAdmin';
import type { SessionInfo } from '@/contract/types';

const userInclude = {
  roleAssignments: { include: { scopes: true }, orderBy: { role: 'asc' } },
} satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function toUserSummary(u: UserRow): UserSummary {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    position: u.position,
    unit: u.unit,
    assignments: u.roleAssignments.map((a) => ({
      assignmentId: a.id,
      role: a.role as Role,
      status: a.status as AuthorisationStatus,
      scopeCodes: a.scopes.map((s) => s.scopeCode).sort(),
      authorisedFrom: a.authorisedFrom?.toISOString() ?? null,
      authorisedUntil: a.authorisedUntil?.toISOString() ?? null,
    })),
  };
}

export async function listUsers(actor: Actor): Promise<UserSummary[]> {
  assertCan(actor, 'user.manage');
  const rows = await prisma.user.findMany({ include: userInclude, orderBy: { name: 'asc' } });
  return rows.map(toUserSummary);
}

const updateSchema = z
  .object({
    status: z.enum(['PENDING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'REVOKED', 'EXPIRED'], { error: 'Status is invalid' }).optional(),
    scopeCodes: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((v) => v.status !== undefined || v.scopeCodes !== undefined, 'Nothing to update');

export async function updateAssignment(
  actor: Actor,
  assignmentId: string,
  input: { status?: AuthorisationStatus; scopeCodes?: string[] },
): Promise<UserSummary> {
  assertCan(actor, 'user.manage');
  const data = parseInput(updateSchema, input);
  const userId = await prisma.$transaction(async (tx) => {
    const a = await tx.roleAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: { select: { id: true, name: true } }, scopes: true },
    });
    if (!a) throw new DomainError('NOT_FOUND', 'Assignment not found');
    if (data.status !== undefined && a.userId === actor.userId) {
      throw new DomainError('FORBIDDEN', 'You cannot change the status of your own authorisation');
    }
    const scopeCodes = data.scopeCodes ? [...new Set(data.scopeCodes)] : undefined;
    if (scopeCodes) {
      const known = await tx.serviceScope.findMany({ where: { code: { in: scopeCodes } }, select: { code: true } });
      const set = new Set(known.map((s) => s.code));
      const unknown = scopeCodes.find((c) => !set.has(c));
      if (unknown) throw new DomainError('VALIDATION', `Unknown service scope ${unknown}`);
    }
    const changes: string[] = [];
    if (data.status && data.status !== a.status) changes.push(`status ${a.status} -> ${data.status}`);
    if (scopeCodes) {
      await tx.roleAssignmentScope.deleteMany({ where: { assignmentId } });
      if (scopeCodes.length) {
        await tx.roleAssignmentScope.createMany({ data: scopeCodes.map((scopeCode) => ({ assignmentId, scopeCode })) });
      }
      changes.push(`scopes ${scopeCodes.join(', ') || 'none'}`);
    }
    if (data.status) await tx.roleAssignment.update({ where: { id: assignmentId }, data: { status: data.status } });
    await recordAudit(tx, {
      actor,
      action: 'user.updateAssignment',
      entityType: 'USER',
      entityId: a.userId,
      entityLabel: `${a.user.name} (${a.role})`,
      comment: changes.join('; ') || 'No change',
    });
    return a.userId;
  });
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
  return toUserSummary(u);
}

/** The signed-in view for GET /api/session. Permissions are empty unless the assignment is usable. */
export async function getSessionInfo(actor: Actor): Promise<SessionInfo> {
  const now = new Date();
  const u = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: {
      roleAssignments: {
        where: {
          status: { in: ['ACTIVE', 'RESTRICTED'] },
          AND: [
            { OR: [{ authorisedFrom: null }, { authorisedFrom: { lte: now } }] },
            { OR: [{ authorisedUntil: null }, { authorisedUntil: { gte: now } }] },
          ],
        },
        select: { role: true },
      },
    },
  });
  if (!u) throw new DomainError('UNAUTHENTICATED', 'Sign in required');
  const usable = isAssignmentCurrentlyUsable(actor, now);
  const roles = new Set(u.roleAssignments.map((a) => a.role));
  return {
    user: { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, position: u.position, unit: u.unit },
    role: actor.role,
    roles: ROLES.filter((r) => roles.has(r)),
    assignmentStatus: actor.assignmentStatus,
    scopeCodes: actor.scopeCodes,
    permissions: usable ? [...ROLE_ACTIONS[actor.role]] : [],
  };
}
