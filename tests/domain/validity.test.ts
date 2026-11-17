import { describe, expect, it } from 'vitest';
import { computeValidUntil, displayCertificateStatus } from '@/domain/validity';

const DAY = 86_400_000;
const now = new Date('2026-11-17T10:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * DAY);

describe('computeValidUntil', () => {
  it('36 months minus one day', () => {
    expect(computeValidUntil(new Date('2024-10-14T00:00:00Z'), 36).toISOString().slice(0, 10)).toBe('2027-10-13');
  });
  it('12 months minus one day', () => {
    expect(computeValidUntil(new Date('2024-10-14T00:00:00Z'), 12).toISOString().slice(0, 10)).toBe('2025-10-13');
  });
  it('clamps end of month', () => {
    expect(computeValidUntil(new Date('2024-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2024-02-28');
  });
});

describe('displayCertificateStatus', () => {
  // Window is measured to the end of validUntil's UTC day (now = 2026-11-17T10:00Z).
  it('ACTIVE when more than 30 days remain', () => {
    expect(displayCertificateStatus({ status: 'ACTIVE', validUntil: new Date('2026-12-17T00:00:00Z') }, now)).toBe('ACTIVE');
  });
  it('EXPIRING when 30 days or fewer remain', () => {
    expect(displayCertificateStatus({ status: 'ACTIVE', validUntil: new Date('2026-12-16T00:00:00Z') }, now)).toBe('EXPIRING');
  });
  it('valid through the whole validUntil day', () => {
    const validUntil = new Date('2027-10-13T00:00:00Z');
    expect(displayCertificateStatus({ status: 'ACTIVE', validUntil }, new Date('2027-10-13T18:00:00Z'))).not.toBe('EXPIRED');
    expect(displayCertificateStatus({ status: 'ACTIVE', validUntil }, new Date('2027-10-14T00:00:01Z'))).toBe('EXPIRED');
  });
  it('EXPIRED when past', () => {
    expect(displayCertificateStatus({ status: 'ACTIVE', validUntil: inDays(-1) }, now)).toBe('EXPIRED');
    expect(displayCertificateStatus({ status: 'IN_RENEWAL', validUntil: inDays(-1) }, now)).toBe('EXPIRED');
  });
  it('IN_RENEWAL not yet expired stays IN_RENEWAL', () => {
    expect(displayCertificateStatus({ status: 'IN_RENEWAL', validUntil: inDays(5) }, now)).toBe('IN_RENEWAL');
  });
  it('SUSPENDED past stays SUSPENDED', () => {
    expect(displayCertificateStatus({ status: 'SUSPENDED', validUntil: inDays(-10) }, now)).toBe('SUSPENDED');
  });
  it('REVOKED stays REVOKED', () => {
    expect(displayCertificateStatus({ status: 'REVOKED', validUntil: inDays(100) }, now)).toBe('REVOKED');
  });
});
