import { DomainError } from './errors';
import type { DocumentStatus, TransitionResult, WorkflowEvent, WorkflowState } from './types';

type Target = TransitionResult;

const t = (request: Target['request'], document: DocumentStatus, effects: Target['effects'] = {}): Target => ({
  request,
  document,
  effects,
});

const TABLE: Record<string, Target> = {
  'SUBMITTED/NONE/PREPARE': t('IN_PREPARATION', 'IN_PROGRESS', { createDraft: true }),
  'IN_PREPARATION/REJECTED/PREPARE': t('IN_PREPARATION', 'IN_PROGRESS', { createDraft: true }),
  'IN_PREPARATION/IN_PROGRESS/SUBMIT': t('IN_VERIFICATION', 'UNDER_VERIFICATION'),
  'REVISION_REQUIRED/REVISION/SUBMIT': t('IN_VERIFICATION', 'UNDER_VERIFICATION'),
  'IN_VERIFICATION/UNDER_VERIFICATION/APPROVE': t('READY_FOR_SIGNING', 'READY_FOR_SIGNING'),
  'IN_VERIFICATION/UNDER_VERIFICATION/RETURN': t('REVISION_REQUIRED', 'REVISION', { bumpVersion: true }),
  'READY_FOR_SIGNING/READY_FOR_SIGNING/SIGN': t('ISSUED', 'SIGNED', { issueCertificate: true }),
  'READY_FOR_SIGNING/READY_FOR_SIGNING/REJECT': t('IN_PREPARATION', 'REJECTED'),
};

export function nextState(current: WorkflowState, event: WorkflowEvent): TransitionResult {
  const key = `${current.request}/${current.document ?? 'NONE'}/${event}`;
  const hit = TABLE[key];
  if (!hit) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Cannot ${event} when request is ${current.request} and document is ${current.document ?? 'none'}`,
    );
  }
  return { request: hit.request, document: hit.document, effects: { ...hit.effects } };
}

export function canEditDocument(status: DocumentStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'REVISION';
}
