import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/repositories/prisma';
import { nextSequence } from '@/repositories/sequences';
import { resetDb } from '../setup/db';

describe('nextSequence', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('allocates unique sequential numbers under parallel calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => prisma.$transaction((tx) => nextSequence(tx, 'X'))),
    );
    expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('separate keys are independent', async () => {
    const a1 = await prisma.$transaction((tx) => nextSequence(tx, 'A'));
    const a2 = await prisma.$transaction((tx) => nextSequence(tx, 'A'));
    const b1 = await prisma.$transaction((tx) => nextSequence(tx, 'B'));
    expect([a1, a2, b1]).toEqual([1, 2, 1]);
  });
});
