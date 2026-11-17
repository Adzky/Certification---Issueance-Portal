import { statusLabel } from './status';

/** Human-readable text for the audit `action` codes (the API keeps the raw codes). */
export const ACTION_LABEL: Record<string, string> = {
  'request.create': 'Request created',
  'document.prepare': 'Draft prepared',
  'document.edit': 'Draft edited',
  'document.submit': 'Submitted for verification',
  'document.verify': 'Verified',
  'document.return': 'Returned for revision',
  'document.sign': 'Signed',
  'document.reject': 'Rejected',
  'certificate.issue': 'Certificate issued',
  'certificate.suspend': 'Certificate suspended',
  'certificate.reinstate': 'Certificate reinstated',
  'certificate.revoke': 'Certificate revoked',
  'registration.submit': 'Registration submitted',
  'registration.approve': 'Registration approved',
  'registration.reject': 'Registration rejected',
  'registration.decide': 'Registration decided',
  'user.updateAssignment': 'Authorisation updated',
};

export const actionLabel = (action: string): string => ACTION_LABEL[action] ?? statusLabel(action.replace(/\./g, '_'));

/**
 * Rewrites the dashboard's "Name · action.code · Entity" activity line with the readable action label.
 * Lines in any other shape are returned unchanged.
 */
export function humaniseActivity(text: string): string {
  const parts = text.split(' · ');
  if (parts.length < 3 || !/^[a-z]+(\.[A-Za-z]+)+$/.test(parts[1]!)) return text;
  parts[1] = actionLabel(parts[1]!);
  return parts.join(' · ');
}
