import type { Tx } from '@/repositories/prisma';
import type { Role } from '@/domain/types';

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
