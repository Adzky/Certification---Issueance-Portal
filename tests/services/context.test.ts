import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/domain/types';
import { readableScopes } from '@/services/context';

const actor = (over: Partial<Actor> = {}) => ({
  userId: 'u',
  role: 'ISSUANCE_OFFICER' as const,
  assignmentStatus: 'ACTIVE' as const,
  scopeCodes: ['QMS', 'ISMS'],
  ...over,
});

describe('readableScopes', () => {
  it('does not expose scopes to a suspended manager', () => {
    expect(readableScopes(actor({ role: 'ISSUANCE_MANAGER', assignmentStatus: 'SUSPENDED' }))).toEqual([]);
  });

  it('does not give an expired admin unrestricted reads', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const expiredAdmin = Object.assign(actor({ role: 'SYSTEM_ADMIN' }), {
        authorisedUntil: new Date(now.getTime() - 1),
      });
      expect(readableScopes(expiredAdmin)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps active manager reads unrestricted', () => {
    expect(readableScopes(actor({ role: 'ISSUANCE_MANAGER' }))).toBeNull();
  });

  it('limits restricted actors to their remaining scopes', () => {
    const restricted = actor({ assignmentStatus: 'RESTRICTED', scopeCodes: ['QMS'] });
    expect(readableScopes(restricted)).toEqual(['QMS']);
  });
});
