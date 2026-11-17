import { describe, expect, it } from 'vitest';
import { certificateNumber, draftNumber, requestNumber, sequenceKey } from '@/domain/numbering';
import { VERIFICATION_CHECKLIST } from '@/domain/checklist';

describe('numbering', () => {
  it('certificateNumber', () => {
    expect(certificateNumber('QMS', 2024, 87)).toBe('JMU-QMS-2024-0087');
  });
  it('requestNumber pads and grows', () => {
    expect(requestNumber(2026, 1)).toBe('REQ-2026-0001');
    expect(requestNumber(2024, 1032)).toBe('REQ-2024-1032');
    expect(requestNumber(2026, 12345)).toBe('REQ-2026-12345');
  });
  it('draftNumber', () => {
    expect(draftNumber(2026, 108)).toBe('DRF-2026-0108');
  });
  it('sequenceKey', () => {
    expect(sequenceKey('REQ', 2026)).toBe('REQ-2026');
    expect(sequenceKey('DRF', 2026)).toBe('DRF-2026');
    expect(sequenceKey('CERT', 2026, 'QMS')).toBe('CERT-QMS-2026');
  });
});

describe('checklist', () => {
  it('has the six keys in order', () => {
    expect(VERIFICATION_CHECKLIST.map((c) => c.key)).toEqual([
      'client_data',
      'scope_matches',
      'results_consistent',
      'references_valid',
      'numbering_metadata',
      'impartiality',
    ]);
    expect(VERIFICATION_CHECKLIST.every((c) => c.label.length > 0)).toBe(true);
  });
});
