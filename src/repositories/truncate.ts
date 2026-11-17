import type { PrismaClient } from '@prisma/client';

/** Deletes every row of every table, children before parents (FK-safe). */
export async function truncateAll(db: PrismaClient): Promise<void> {
  await db.$transaction([
    db.controlDocument.deleteMany(),
    db.registrationApplication.deleteMany(),
    db.verificationResult.deleteMany(),
    db.signature.deleteMany(),
    db.certificate.deleteMany(),
    db.document.deleteMany(),
    db.issuanceRequest.deleteMany(),
    db.client.deleteMany(),
    db.roleAssignmentScope.deleteMany(),
    db.roleAssignment.deleteMany(),
    db.user.deleteMany(),
    db.serviceScope.deleteMany(),
    db.auditLog.deleteMany(),
    db.notification.deleteMany(),
    db.numberSequence.deleteMany(),
  ]);
}
