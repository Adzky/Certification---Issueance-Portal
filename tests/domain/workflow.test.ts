import { describe, expect, it } from 'vitest';
import { canEditDocument, nextState } from '@/domain/workflow';
import type { DocumentStatus, RequestStatus, WorkflowEvent } from '@/domain/types';

const rows: [RequestStatus, DocumentStatus | null, WorkflowEvent, RequestStatus, DocumentStatus, object][] = [
  ['SUBMITTED', null, 'PREPARE', 'IN_PREPARATION', 'IN_PROGRESS', { createDraft: true }],
  ['IN_PREPARATION', 'REJECTED', 'PREPARE', 'IN_PREPARATION', 'IN_PROGRESS', { createDraft: true }],
  ['IN_PREPARATION', 'IN_PROGRESS', 'SUBMIT', 'IN_VERIFICATION', 'UNDER_VERIFICATION', {}],
  ['REVISION_REQUIRED', 'REVISION', 'SUBMIT', 'IN_VERIFICATION', 'UNDER_VERIFICATION', {}],
  ['IN_VERIFICATION', 'UNDER_VERIFICATION', 'APPROVE', 'READY_FOR_SIGNING', 'READY_FOR_SIGNING', {}],
  ['IN_VERIFICATION', 'UNDER_VERIFICATION', 'RETURN', 'REVISION_REQUIRED', 'REVISION', { bumpVersion: true }],
  ['READY_FOR_SIGNING', 'READY_FOR_SIGNING', 'SIGN', 'ISSUED', 'SIGNED', { issueCertificate: true }],
  ['READY_FOR_SIGNING', 'READY_FOR_SIGNING', 'REJECT', 'IN_PREPARATION', 'REJECTED', {}],
];

describe('nextState', () => {
  it.each(rows)('%s / %s + %s', (req, doc, event, toReq, toDoc, effects) => {
    expect(nextState({ request: req, document: doc }, event)).toEqual({
      request: toReq,
      document: toDoc,
      effects,
    });
  });

  it('rejects SIGN from UNDER_VERIFICATION', () => {
    expect(() => nextState({ request: 'IN_VERIFICATION', document: 'UNDER_VERIFICATION' }, 'SIGN')).toThrowError(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });

  it('rejects PREPARE while a live draft exists', () => {
    expect(() => nextState({ request: 'IN_PREPARATION', document: 'IN_PROGRESS' }, 'PREPARE')).toThrowError(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });

  it('nothing leaves ISSUED', () => {
    for (const e of ['PREPARE', 'SUBMIT', 'APPROVE', 'RETURN', 'SIGN', 'REJECT'] as WorkflowEvent[]) {
      expect(() => nextState({ request: 'ISSUED', document: 'SIGNED' }, e)).toThrowError(
        expect.objectContaining({ code: 'INVALID_TRANSITION' }),
      );
    }
  });
});

describe('canEditDocument', () => {
  it.each(['IN_PROGRESS', 'REVISION'] as DocumentStatus[])('true for %s', (s) => {
    expect(canEditDocument(s)).toBe(true);
  });
  it.each(['UNDER_VERIFICATION', 'READY_FOR_SIGNING', 'SIGNED', 'REJECTED'] as DocumentStatus[])('false for %s', (s) => {
    expect(canEditDocument(s)).toBe(false);
  });
});
