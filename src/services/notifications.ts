import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/repositories/prisma';
import type { Actor, Role } from '@/domain/types';
import type { NotificationList } from '@/contract/types';

export interface NotificationInput {
  recipientRole?: Role;
  recipientUserId?: string;
  message: string;
  link?: string;
}

export async function notify(tx: Tx, n: NotificationInput): Promise<void> {
  await tx.notification.create({
    data: {
      recipientRole: n.recipientRole ?? null,
      recipientUserId: n.recipientUserId ?? null,
      message: n.message,
      link: n.link ?? null,
    },
  });
}

const LIST_LIMIT = 50;

const visibleTo = (actor: Actor): Prisma.NotificationWhereInput => ({
  OR: [{ recipientUserId: actor.userId }, { recipientRole: actor.role }],
});

/** Notifications addressed to the actor or to the actor's current role, newest first. */
export async function listNotifications(actor: Actor): Promise<NotificationList> {
  const where = visibleTo(actor);
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIST_LIMIT }),
    prisma.notification.count({ where: { AND: [where, { read: false }] } }),
  ]);
  return {
    items: rows.map((n) => ({ id: n.id, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt.toISOString() })),
    unread,
  };
}

/**
 * Marks the given (or all) visible notifications read. UI-state only, so it is not
 * audited. Demo simplification: the read flag is per notification, so a role-wide
 * notification read by one member is read for the whole role.
 */
export async function markNotificationsRead(actor: Actor, input: { ids?: string[] } = {}): Promise<NotificationList> {
  const and: Prisma.NotificationWhereInput[] = [visibleTo(actor), { read: false }];
  if (input.ids) and.push({ id: { in: input.ids } });
  await prisma.notification.updateMany({ where: { AND: and }, data: { read: true } });
  return listNotifications(actor);
}
