/** Status enum → pill tone and label. Pure, shared by every list and detail screen. */
import type { Tone } from './tones';

/** Which entity a status belongs to, for the few values whose colour depends on it. */
export type StatusKind = 'request' | 'document' | 'certificate' | 'authorisation' | 'registration' | 'priority';

const TONE: Record<string, Tone> = {
  // amber: waiting for someone to act
  PENDING_PREPARATION: 'amber',
  SUBMITTED: 'amber',
  IN_PREPARATION: 'amber',
  IN_PROGRESS: 'amber',
  PENDING: 'amber',
  RESTRICTED: 'amber',
  EXPIRING: 'amber',
  // blue: being checked / neutral
  IN_VERIFICATION: 'blue',
  UNDER_VERIFICATION: 'blue',
  NORMAL: 'blue',
  // green: good to go / done
  READY_FOR_SIGNING: 'green',
  ACTIVE: 'green',
  ISSUED: 'green',
  APPROVED: 'green',
  SIGNED: 'green',
  // red: blocked or bad
  REVISION_REQUIRED: 'red',
  REJECTED: 'red',
  SUSPENDED: 'red',
  REVOKED: 'red',
  HIGH: 'red',
  // purple: in a loop
  REVISION: 'purple',
  IN_RENEWAL: 'purple',
  // grey: inactive
  DRAFT: 'grey',
  EXPIRED: 'grey',
  LOW: 'grey',
};

const KIND_TONE: Partial<Record<StatusKind, Record<string, Tone>>> = {
  request: { ISSUED: 'purple' },
};

/** Pill tone for a status value; unknown values are grey. `AWAITING_*` values are amber. */
export function statusTone(status: string, kind?: StatusKind): Tone {
  const s = status.toUpperCase();
  const byKind = kind ? KIND_TONE[kind]?.[s] : undefined;
  if (byKind) return byKind;
  if (TONE[s]) return TONE[s];
  if (s.startsWith('AWAITING')) return 'amber';
  return 'grey';
}

const MINOR_WORDS = new Set(['for', 'of', 'and', 'to', 'by', 'the', 'a', 'an', 'on', 'at']);

/** `READY_FOR_SIGNING` → `Ready for Signing` (Title Case, short joining words lower case). */
export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && MINOR_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}
