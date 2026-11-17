import type { Priority } from '../../src/domain/types';
import { SLA_WORKING_DAYS } from '../../src/domain/sla';
import type { Rng } from './prng';

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export interface AuditRowInput {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  comment: string | null;
  at: Date;
}

/** Moves `ms` to a working-hours time of day (09:00-16:59 WIB = 02:00-09:59 UTC), keeping the UTC date. */
export function atWorkHour(ms: number, rng: Rng): Date {
  const d = new Date(ms);
  d.setUTCHours(rng.int(2, 9), rng.int(0, 59), rng.int(0, 59), 0);
  return d;
}

/**
 * `n` increasing timestamps: the first is exactly `start`, the last exactly `end`
 * (when n > 1); the ones in between are spread with random gaps.
 */
export function spreadTimes(start: number, end: number, n: number, rng: Rng): number[] {
  if (n <= 0) return [];
  if (n === 1) return [start];
  const gaps = Array.from({ length: n - 1 }, () => rng.between(0.3, 1.6));
  const total = gaps.reduce((a, b) => a + b, 0);
  const out = [start];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += gaps[i]!;
    out.push(Math.round(start + ((end - start) * acc) / total));
  }
  return out;
}

/**
 * Calendar time between a request being created and its certificate being issued.
 * On-time requests finish well inside the working-day SLA (counted in calendar days, so a
 * weekend inside the window cannot push them over the due date); late ones overrun it.
 */
export function slaSpanMs(priority: Priority, late: boolean, rng: Rng): number {
  const workingDays = SLA_WORKING_DAYS[priority];
  const days = late ? ((workingDays * 7) / 5) * rng.between(1.2, 1.8) : workingDays * rng.between(0.4, 0.92);
  return Math.round(days * DAY);
}
