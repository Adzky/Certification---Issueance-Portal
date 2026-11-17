import { describe, expect, it } from 'vitest';
import { statusLabel, statusTone } from '@/lib/status';

describe('statusLabel', () => {
  it('title-cases enum values, keeping short joining words lower case', () => {
    expect(statusLabel('READY_FOR_SIGNING')).toBe('Ready for Signing');
    expect(statusLabel('IN_VERIFICATION')).toBe('In Verification');
    expect(statusLabel('REVISION_REQUIRED')).toBe('Revision Required');
    expect(statusLabel('HIGH')).toBe('High');
  });
});

describe('statusTone', () => {
  it.each([
    ['PENDING_PREPARATION', 'amber'], ['SUBMITTED', 'amber'], ['IN_PROGRESS', 'amber'], ['AWAITING_VERIFICATION', 'amber'], ['EXPIRING', 'amber'],
    ['IN_VERIFICATION', 'blue'], ['UNDER_VERIFICATION', 'blue'], ['NORMAL', 'blue'],
    ['READY_FOR_SIGNING', 'green'], ['ACTIVE', 'green'], ['ISSUED', 'green'], ['APPROVED', 'green'], ['SIGNED', 'green'],
    ['REVISION_REQUIRED', 'red'], ['REJECTED', 'red'], ['SUSPENDED', 'red'], ['REVOKED', 'red'], ['HIGH', 'red'],
    ['REVISION', 'purple'], ['IN_RENEWAL', 'purple'],
    ['DRAFT', 'grey'], ['EXPIRED', 'grey'], ['LOW', 'grey'], ['SOMETHING_ELSE', 'grey'],
  ] as const)('%s → %s', (status, tone) => expect(statusTone(status)).toBe(tone));

  it('shows an issued request in purple', () => {
    expect(statusTone('ISSUED', 'request')).toBe('purple');
    expect(statusTone('ISSUED', 'certificate')).toBe('green');
  });
});
