import { describe, expect, it, vi } from 'vitest';
import { assertCan, can, ROLE_LABEL, ROLES } from '@/domain/permissions';
import type { Actor, AuthorisationStatus } from '@/domain/types';

const actor = (over: Partial<Actor> = {}): Actor => ({
  userId: 'u',
  role: 'ISSUANCE_OFFICER',
  assignmentStatus: 'ACTIVE',
  scopeCodes: ['QMS'],
  ...over,
});

describe('can', () => {
  it('officer can create in own scope', () => {
    expect(can(actor(), 'request.create', 'QMS')).toBe(true);
  });
  it('officer cannot act outside scope', () => {
    expect(can(actor(), 'request.create', 'CDKAB')).toBe(false);
  });
  it('restricted user acts within remaining scopes', () => {
    const a = actor({ assignmentStatus: 'RESTRICTED', scopeCodes: ['INS'] });
    expect(can(a, 'request.create', 'INS')).toBe(true);
    expect(can(a, 'request.create', 'QMS')).toBe(false);
  });
  it.each(['SUSPENDED', 'REVOKED', 'EXPIRED', 'PENDING'] as AuthorisationStatus[])(
    '%s users cannot act',
    (s) => {
      expect(can(actor({ assignmentStatus: s }), 'request.create', 'QMS')).toBe(false);
    },
  );
  it('verifier cannot sign', () => {
    expect(can(actor({ role: 'DOCUMENT_VERIFIER' }), 'document.sign', 'QMS')).toBe(false);
  });
  it('signatory cannot verify', () => {
    expect(can(actor({ role: 'AUTHORISED_SIGNATORY' }), 'document.verify', 'QMS')).toBe(false);
  });
  it('scope is optional', () => {
    expect(can(actor({ role: 'SYSTEM_ADMIN' }), 'user.manage')).toBe(true);
  });

  it('rejects actions before the authorisation start bound', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const future = Object.assign(actor(), { authorisedFrom: new Date(now.getTime() + 1) });
      expect(can(future, 'request.create', 'QMS')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects actions after the authorisation end bound', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const expired = Object.assign(actor(), { authorisedUntil: new Date(now.getTime() - 1) });
      expect(can(expired, 'request.create', 'QMS')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows actions at inclusive authorisation bounds', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const atBounds = Object.assign(actor(), { authorisedFrom: now, authorisedUntil: now });
      expect(can(atBounds, 'request.create', 'QMS')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('assertCan', () => {
  it('throws FORBIDDEN', () => {
    expect(() => assertCan(actor(), 'document.sign', 'QMS')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });
  it('passes when allowed', () => {
    expect(() => assertCan(actor(), 'request.create', 'QMS')).not.toThrow();
  });
});

describe('constants', () => {
  it('ROLES in workflow order with labels', () => {
    expect(ROLES.map((r) => ROLE_LABEL[r])).toEqual([
      'Issuance Officer',
      'Document Verifier',
      'Authorised Signatory',
      'Issuance Manager',
      'System Administrator',
    ]);
  });
});
