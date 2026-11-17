import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/repositories/prisma';
import { nextSequence } from '@/repositories/sequences';
import { DomainError } from '@/domain/errors';
import { assertCan } from '@/domain/permissions';
import { requestNumber, sequenceKey } from '@/domain/numbering';
import { computeDueDate } from '@/domain/sla';
import type { Actor, CertificateStatus, Page, Priority, RequestStatus, Role } from '@/domain/types';
import { recordAudit } from './audit';
import {
  assertReadable,
  dateRange,
  paging,
  parseInput,
  readableScopes,
  sortDir,
  statusStats,
  type ListQuery,
} from './context';
import {
  documentInclude,
  requestInclude,
  toDocumentSummary,
  toRequestSummary,
  type RequestDetail,
  type RequestSummary,
  type TimelineEntry,
} from './dto';

const REQUEST_STATUSES: readonly RequestStatus[] = [
  'SUBMITTED',
  'IN_PREPARATION',
  'IN_VERIFICATION',
  'REVISION_REQUIRED',
  'READY_FOR_SIGNING',
  'ISSUED',
];

const createSchema = z.object({
  clientId: z.string().trim().min(1, 'Client is required'),
  scopeCode: z.string().trim().min(1, 'Service scope is required'),
  objectScope: z.string().trim().min(1, 'Object / scope is required').max(500),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']),
});

export async function createRequest(
  actor: Actor,
  input: { clientId: string; scopeCode: string; objectScope: string; priority: Priority },
): Promise<RequestDetail> {
  const data = parseInput(createSchema, input);
  assertCan(actor, 'request.create', data.scopeCode);
  const id = await prisma.$transaction(async (tx) => {
    const [client, scope] = await Promise.all([
      tx.client.findUnique({ where: { id: data.clientId } }),
      tx.serviceScope.findUnique({ where: { code: data.scopeCode } }),
    ]);
    if (!client) throw new DomainError('VALIDATION', 'Unknown client');
    if (!scope) throw new DomainError('VALIDATION', 'Unknown service scope');
    const now = new Date();
    const year = now.getUTCFullYear();
    const number = requestNumber(year, await nextSequence(tx, sequenceKey('REQ', year)));
    const created = await tx.issuanceRequest.create({
      data: {
        number,
        clientId: client.id,
        scopeCode: scope.code,
        objectScope: data.objectScope,
        priority: data.priority,
        status: 'SUBMITTED',
        assigneeId: actor.userId,
        createdById: actor.userId,
        dueDate: computeDueDate(now, data.priority),
        createdAt: now,
      },
    });
    await recordAudit(tx, {
      actor,
      action: 'request.create',
      entityType: 'REQUEST',
      entityId: created.id,
      entityLabel: number,
    });
    return created.id;
  });
  return loadRequestDetail(prisma, id);
}

const SORTABLE = ['createdAt', 'number', 'dueDate', 'priority', 'status', 'updatedAt'] as const;

export async function listRequests(
  actor: Actor,
  q: ListQuery = {},
): Promise<Page<RequestSummary> & { stats: Record<string, number> }> {
  const scopes = readableScopes(actor);
  const visible: Prisma.IssuanceRequestWhereInput = scopes ? { scopeCode: { in: scopes } } : {};
  const where: Prisma.IssuanceRequestWhereInput = { ...visible };
  const and: Prisma.IssuanceRequestWhereInput[] = [];
  if (q.q?.trim()) {
    const term = q.q.trim();
    and.push({
      OR: [
        { number: { contains: term } },
        { objectScope: { contains: term } },
        { client: { name: { contains: term } } },
      ],
    });
  }
  if (q.status) and.push({ status: q.status });
  if (q.scopeCode) and.push({ scopeCode: q.scopeCode });
  if (q.priority) and.push({ priority: q.priority });
  if (q.type) and.push({ scope: { documentType: q.type } });
  const created = dateRange(q);
  if (created) and.push({ createdAt: created });
  if (and.length) where.AND = and;

  const { page, pageSize, skip } = paging(q);
  const sortKey = (SORTABLE as readonly string[]).includes(q.sort ?? '') ? q.sort! : 'createdAt';
  const [rows, total, grouped] = await Promise.all([
    prisma.issuanceRequest.findMany({
      where,
      include: requestInclude,
      orderBy: [{ [sortKey]: sortDir(q) }, { number: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.issuanceRequest.count({ where }),
    prisma.issuanceRequest.groupBy({ by: ['status'], where: visible, _count: { _all: true } }),
  ]);
  return {
    items: rows.map(toRequestSummary),
    total,
    page,
    pageSize,
    stats: statusStats(grouped, REQUEST_STATUSES),
  };
}

export async function getRequest(actor: Actor, id: string): Promise<RequestDetail> {
  const scope = await prisma.issuanceRequest.findUnique({ where: { id }, select: { scopeCode: true } });
  if (!scope) throw new DomainError('NOT_FOUND', 'Request not found');
  assertReadable(actor, scope.scopeCode, 'Request');
  return loadRequestDetail(prisma, id);
}

/** Loads a request with its documents (incl. rejected) and audit timeline. No access check. */
export async function loadRequestDetail(db: Tx, id: string): Promise<RequestDetail> {
  const r = await db.issuanceRequest.findUnique({
    where: { id },
    include: {
      ...requestInclude,
      documents: { include: documentInclude, orderBy: [{ createdAt: 'asc' }, { number: 'asc' }] },
      certificate: { select: { id: true, number: true, status: true } },
    },
  });
  if (!r) throw new DomainError('NOT_FOUND', 'Request not found');
  const docIds = r.documents.map((d) => d.id);
  return {
    ...toRequestSummary(r),
    clientAddress: r.client.address,
    documents: r.documents.map(toDocumentSummary),
    timeline: await loadTimeline(db, r.id, docIds),
    certificate: r.certificate
      ? { id: r.certificate.id, number: r.certificate.number, status: r.certificate.status as CertificateStatus }
      : null,
  };
}

async function loadTimeline(db: Tx, requestId: string, documentIds: string[]): Promise<TimelineEntry[]> {
  const rows = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'REQUEST', entityId: requestId },
        ...(documentIds.length ? [{ entityType: 'DOCUMENT', entityId: { in: documentIds } }] : []),
      ],
    },
    orderBy: { at: 'asc' },
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const users = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((a) => ({
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
  }));
}
