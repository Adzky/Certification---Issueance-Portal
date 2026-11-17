import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/repositories/prisma';
import { DomainError } from '@/domain/errors';
import type { Action, Actor, DocumentStatus, Page } from '@/domain/types';
import {
  actionableScopes,
  assertReadable,
  dateRange,
  paging,
  readableScopes,
  sortDir,
  statusStats,
  type ListQuery,
} from './context';
import {
  documentDetailInclude,
  documentInclude,
  toDocumentDetail,
  toDocumentSummary,
  type DocumentDetail,
  type DocumentSummary,
} from './dto';

const DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  'IN_PROGRESS',
  'UNDER_VERIFICATION',
  'REVISION',
  'READY_FOR_SIGNING',
  'SIGNED',
  'REJECTED',
];

import type { DocumentQueue } from '@/contract/types';

export type { DocumentQueue } from '@/contract/types';

/** Status + the actions that make an item "actionable" for each work queue. */
const QUEUES: Record<'verification' | 'signing' | 'returned', { status: DocumentStatus; actions: Action[] }> = {
  verification: { status: 'UNDER_VERIFICATION', actions: ['document.verify'] },
  signing: { status: 'READY_FOR_SIGNING', actions: ['document.sign'] },
  // Returned drafts: the officer must fix them; the verifier who returned them watches them.
  returned: { status: 'REVISION', actions: ['document.edit', 'document.verify'] },
};

/** Loads a document detail (incl. verifications, signature, rejection reason). No access check. */
export async function loadDocumentDetail(db: Tx, id: string): Promise<DocumentDetail> {
  const d = await db.document.findUnique({ where: { id }, include: documentDetailInclude });
  if (!d) throw new DomainError('NOT_FOUND', 'Document not found');
  let rejectionReason: string | null = null;
  if (d.status === 'REJECTED') {
    const entry = await db.auditLog.findFirst({
      where: { entityType: 'DOCUMENT', entityId: id, action: 'document.reject' },
      orderBy: { at: 'desc' },
    });
    rejectionReason = entry?.comment ?? null;
  }
  return toDocumentDetail(d, rejectionReason);
}

export async function getDocument(actor: Actor, id: string): Promise<DocumentDetail> {
  const d = await prisma.document.findUnique({ where: { id }, select: { request: { select: { scopeCode: true } } } });
  if (!d) throw new DomainError('NOT_FOUND', 'Document not found');
  assertReadable(actor, d.request.scopeCode, 'Document');
  return loadDocumentDetail(prisma, id);
}

const SORTS: Record<string, (dir: 'asc' | 'desc') => Prisma.DocumentOrderByWithRelationInput> = {
  createdAt: (dir) => ({ createdAt: dir }),
  updatedAt: (dir) => ({ updatedAt: dir }),
  number: (dir) => ({ number: dir }),
  status: (dir) => ({ status: dir }),
  dueDate: (dir) => ({ request: { dueDate: dir } }),
  priority: (dir) => ({ request: { priority: dir } }),
  requestNumber: (dir) => ({ request: { number: dir } }),
};

export async function listDocuments(
  actor: Actor,
  q: ListQuery & { queue?: DocumentQueue } = {},
): Promise<Page<DocumentSummary> & { stats: Record<string, number> }> {
  const scopes = readableScopes(actor);
  const visible: Prisma.DocumentWhereInput = scopes ? { request: { scopeCode: { in: scopes } } } : {};
  const and: Prisma.DocumentWhereInput[] = [visible];

  if (q.queue === 'verifiedByMe') and.push({ verifications: { some: { verifierId: actor.userId } } });
  else if (q.queue === 'signedByMe') and.push({ signature: { is: { signerId: actor.userId } } });
  else if (q.queue) {
    const def = QUEUES[q.queue];
    if (!def) throw new DomainError('VALIDATION', `Unknown queue ${q.queue}`);
    and.push({ status: def.status, request: { scopeCode: { in: actionableScopes(actor, def.actions) } } });
  }
  if (q.q?.trim()) {
    const term = q.q.trim();
    and.push({
      OR: [
        { number: { contains: term } },
        { request: { number: { contains: term } } },
        { request: { client: { name: { contains: term } } } },
      ],
    });
  }
  if (q.status) and.push({ status: q.status });
  if (q.scopeCode) and.push({ request: { scopeCode: q.scopeCode } });
  if (q.priority) and.push({ request: { priority: q.priority } });
  if (q.type) and.push({ type: q.type });
  const created = dateRange(q);
  if (created) and.push({ createdAt: created });
  const where: Prisma.DocumentWhereInput = { AND: and };

  const { page, pageSize, skip } = paging(q);
  const order = (SORTS[q.sort ?? ''] ?? SORTS.updatedAt)(sortDir(q));
  const [rows, total, grouped] = await Promise.all([
    prisma.document.findMany({
      where,
      include: documentInclude,
      orderBy: [order, { number: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.document.count({ where }),
    prisma.document.groupBy({ by: ['status'], where: visible, _count: { _all: true } }),
  ]);
  return {
    items: rows.map(toDocumentSummary),
    total,
    page,
    pageSize,
    stats: statusStats(grouped, DOCUMENT_STATUSES),
  };
}
