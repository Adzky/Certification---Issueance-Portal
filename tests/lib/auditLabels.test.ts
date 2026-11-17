import { describe, expect, it } from 'vitest';
import { actionLabel, humaniseActivity } from '@/lib/auditLabels';

describe('audit labels', () => {
  it('maps known codes and title-cases unknown ones', () => {
    expect(actionLabel('document.sign')).toBe('Signed');
    expect(actionLabel('registration.approve')).toBe('Registration approved');
    expect(actionLabel('thing.happened')).toBe('Thing Happened');
  });

  it('rewrites the dashboard activity line but leaves other text alone', () => {
    expect(humaniseActivity('Budi Santoso · document.sign · DOC-1')).toBe('Budi Santoso · Signed · DOC-1');
    expect(humaniseActivity('System · registration.submit · Dwi · Ananda')).toBe('System · Registration submitted · Dwi · Ananda');
    expect(humaniseActivity('plain text')).toBe('plain text');
  });
});
