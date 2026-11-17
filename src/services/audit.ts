import type { Tx } from '@/repositories/prisma';
import type { Actor } from '@/domain/types';

export type AuditEntityType = 'REQUEST' | 'DOCUMENT' | 'CERTIFICATE' | 'REGISTRATION' | 'USER';

export interface AuditEntry {
  actor?: Actor;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  comment?: string;
}

let lastAt = 0;

/**
 * Strictly increasing timestamp (per process) so audit rows written within the
 * same millisecond still sort in the order they happened.
 */
function auditTimestamp(): Date {
  const now = Date.now();
  lastAt = now > lastAt ? now : lastAt + 1;
  return new Date(lastAt);
}

export async function recordAudit(tx: Tx, e: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: e.actor?.userId ?? null,
      actorRole: e.actor?.role ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      entityLabel: e.entityLabel,
      comment: e.comment ?? null,
      at: auditTimestamp(),
    },
  });
}
