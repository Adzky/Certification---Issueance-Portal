import { describe, expect, it } from 'vitest';
import { safeDecode } from '@/lib/safeDecode';

describe('safeDecode', () => {
  it('decodes valid percent-encoding', () => {
    expect(safeDecode('JMU%20QMS')).toBe('JMU QMS');
    expect(safeDecode('JMU-QMS-2026-0001')).toBe('JMU-QMS-2026-0001');
  });
  it('returns malformed input unchanged instead of throwing', () => {
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A');
    expect(safeDecode('%zz')).toBe('%zz');
  });
});
