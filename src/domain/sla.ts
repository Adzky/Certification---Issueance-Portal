import type { Priority } from './types';

const DAY_MS = 86_400_000;

export const SLA_WORKING_DAYS: Record<Priority, number> = { HIGH: 3, NORMAL: 7, LOW: 14 };

const startOfUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Add working days (skipping Saturday/Sunday, UTC), keeping the time of day. */
export function computeDueDate(createdAt: Date, priority: Priority): Date {
  const r = new Date(createdAt.getTime());
  let left = SLA_WORKING_DAYS[priority];
  while (left > 0) {
    r.setUTCDate(r.getUTCDate() + 1);
    const wd = r.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return r;
}

export function isSlaAchieved(dueDate: Date, issuedAt: Date): boolean {
  return issuedAt.getTime() < startOfUtcDay(dueDate) + DAY_MS;
}

export function isDueSoon(dueDate: Date, now: Date): boolean {
  const diff = Math.round((startOfUtcDay(dueDate) - startOfUtcDay(now)) / DAY_MS);
  return diff >= 0 && diff <= 7;
}
