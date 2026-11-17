import type { CertificateDisplayStatus, CertificateStatus } from './types';

const DAY_MS = 86_400_000;

/** Add calendar months in UTC, clamping to the last day of the target month. */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const r = new Date(date.getTime());
  r.setUTCDate(1);
  r.setUTCFullYear(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay));
  return r;
}

export function computeValidUntil(issueDate: Date, termMonths: number): Date {
  return new Date(addMonthsUtc(issueDate, termMonths).getTime() - DAY_MS);
}

export function displayCertificateStatus(
  c: { status: CertificateStatus; validUntil: Date },
  now: Date,
): CertificateDisplayStatus {
  // A certificate is valid through the whole of its validUntil UTC day.
  const v = c.validUntil;
  const endOfValidDay = Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()) + DAY_MS - 1;
  const live = c.status === 'ACTIVE' || c.status === 'IN_RENEWAL';
  if (live && now.getTime() > endOfValidDay) return 'EXPIRED';
  if (c.status === 'ACTIVE' && endOfValidDay - now.getTime() <= 30 * DAY_MS) return 'EXPIRING';
  return c.status;
}
