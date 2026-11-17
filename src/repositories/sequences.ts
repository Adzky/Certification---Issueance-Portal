import type { Tx } from './prisma';

/** Allocates the next number for `key` (first call returns 1). Run inside a transaction. */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  await tx.numberSequence.upsert({ where: { key }, create: { key, next: 1 }, update: {} });
  const row = await tx.numberSequence.update({ where: { key }, data: { next: { increment: 1 } } });
  return row.next - 1;
}
