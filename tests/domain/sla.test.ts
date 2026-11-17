import { describe, expect, it } from 'vitest';
import { computeDueDate, isDueSoon, isSlaAchieved, SLA_WORKING_DAYS } from '@/domain/sla';

const d = (s: string) => new Date(s);
const day = (x: Date) => x.toISOString().slice(0, 10);

describe('SLA', () => {
  it('working days table', () => {
    expect(SLA_WORKING_DAYS).toEqual({ HIGH: 3, NORMAL: 7, LOW: 14 });
  });
  it('computeDueDate skips weekends', () => {
    expect(day(computeDueDate(d('2026-11-13T00:00:00Z'), 'HIGH'))).toBe('2026-11-18');
    expect(day(computeDueDate(d('2026-11-16T00:00:00Z'), 'NORMAL'))).toBe('2026-11-25');
    expect(day(computeDueDate(d('2026-11-16T00:00:00Z'), 'LOW'))).toBe('2026-12-04');
  });
  it('isSlaAchieved is inclusive of the due day', () => {
    expect(isSlaAchieved(d('2026-11-18T00:00:00Z'), d('2026-11-18T23:00:00Z'))).toBe(true);
    expect(isSlaAchieved(d('2026-11-18T00:00:00Z'), d('2026-11-19T00:00:00Z'))).toBe(false);
  });
  it('isDueSoon', () => {
    const now = d('2026-11-17T10:00:00Z');
    expect(isDueSoon(d('2026-11-24T00:00:00Z'), now)).toBe(true);
    expect(isDueSoon(d('2026-11-25T00:00:00Z'), now)).toBe(false);
    expect(isDueSoon(d('2026-11-16T00:00:00Z'), now)).toBe(false);
    expect(isDueSoon(d('2026-11-17T00:00:00Z'), now)).toBe(true);
  });
});
