import type { RequestStatus } from '@/domain/types';
import type { WorkflowStep } from '@/components/common/WorkflowStepper';
import { formatDate } from '@/lib/format';

/** Five-stage request progress (Request Submitted → Preparation → Verification → Signing → Issued). */
export function requestSteps(status: RequestStatus, createdAt: string, issuedAt: string | null): WorkflowStep[] {
  const position: Record<RequestStatus, number> = {
    SUBMITTED: 1,
    IN_PREPARATION: 1,
    IN_VERIFICATION: 2,
    REVISION_REQUIRED: 2,
    READY_FOR_SIGNING: 3,
    ISSUED: 5,
  };
  const current = position[status];
  const sub: Partial<Record<RequestStatus, string>> = {
    SUBMITTED: '(Pending)',
    IN_PREPARATION: '(In Progress)',
    IN_VERIFICATION: '(In Progress)',
    REVISION_REQUIRED: '(Revision Required)',
    READY_FOR_SIGNING: '(Awaiting Signature)',
  };
  const labels = ['Request Submitted', 'Preparation', 'Verification', 'Signing', 'Issued'];
  return labels.map((label, i) => ({
    label,
    state: i < current ? 'done' : i === current ? 'current' : 'todo',
    sub: i === 0 ? formatDate(createdAt) : i === 4 && issuedAt ? formatDate(issuedAt) : i === current ? sub[status] : undefined,
  }));
}

export const NEXT_ACTION: Record<RequestStatus, string> = {
  SUBMITTED: 'Prepare draft certificate/report',
  IN_PREPARATION: 'Complete the draft and send it to verification',
  IN_VERIFICATION: 'Awaiting document verification',
  REVISION_REQUIRED: 'Revise the draft and resubmit',
  READY_FOR_SIGNING: 'Awaiting authorised signatory',
  ISSUED: 'Certificate issued',
};
