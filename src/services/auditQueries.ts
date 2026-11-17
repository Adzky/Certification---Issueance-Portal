import type { Prisma } from '@prisma/client';
import { prisma } from '@/repositories/prisma';
import type { Actor, Page, Role } from '@/domain/types';
import { canViewAll, dateRange, paging, sortDir, type ListQuery } from './context';
import type { AuditEntry } from './dtoAdmin';

const SORTABLE = ['at', 'action', 'entityType', 'entityLabel'] as const;

/**
 * Audit trail. `records.viewAll` sees everything; everyone else sees entries they
 * wrote plus entries on entities they have themselves touched.
 */
export async function listAudit(
  actor: Actor,
  q: ListQuery & { entityType?: string; entityId?: string; actorId?: string } = {},
): Promise<Page<AuditEntry>> {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (!canViewAll(actor)) {
    const touched = await prisma.auditLog.findMany({
      where: { actorId: actor.userId },
      select: { entityId: true },
      distinct: ['entityId'],
    });
    and.push({ OR: [{ actorId: actor.userId }, { entityId: { in: touched.map((t) => t.entityId) } }] });
  }
  if (q.entityType) and.push({ entityType: q.entityType });
  if (q.entityId) and.push({ entityId: q.entityId });
  if (q.actorId) and.push({ actorId: q.actorId });
  if (q.q?.trim()) {
    const term = q.q.trim();
    and.push({ OR: [{ action: { contains: term } }, { entityLabel: { contains: term } }, { comment: { contains: term } }] });
  }
  const range = dateRange(q);
  if (range) and.push({ at: range });
  const where: Prisma.AuditLogWhereInput = { AND: and };

  const { page, pageSize, skip } = paging(q);
  const sortKey = (SORTABLE as readonly string[]).includes(q.sort ?? '') ? q.sort! : 'at';
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [{ [sortKey]: sortDir(q) }, { id: 'desc' }], skip, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const users = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    items: rows.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      entityLabel: a.entityLabel,
      actorId: a.actorId,
      actorName: a.actorId ? (names.get(a.actorId) ?? null) : null,
      actorRole: a.actorRole as Role | null,
      comment: a.comment,
      at: a.at.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}
