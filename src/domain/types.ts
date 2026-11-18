export type Role = 'ISSUANCE_OFFICER' | 'DOCUMENT_VERIFIER' | 'AUTHORISED_SIGNATORY' | 'ISSUANCE_MANAGER' | 'SYSTEM_ADMIN';
export type RequestStatus = 'SUBMITTED' | 'IN_PREPARATION' | 'IN_VERIFICATION' | 'REVISION_REQUIRED' | 'READY_FOR_SIGNING' | 'ISSUED';
export type DocumentStatus = 'IN_PROGRESS' | 'UNDER_VERIFICATION' | 'REVISION' | 'READY_FOR_SIGNING' | 'SIGNED' | 'REJECTED';
export type CertificateStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'IN_RENEWAL';
export type CertificateDisplayStatus = CertificateStatus | 'EXPIRING' | 'EXPIRED';
export type AuthorisationStatus = 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Priority = 'HIGH' | 'NORMAL' | 'LOW';
export type DocumentType = 'CERTIFICATE' | 'INSPECTION_REPORT';
export type Action =
  | 'request.create' | 'document.prepare' | 'document.edit' | 'document.submit'
  | 'document.verify' | 'document.return' | 'document.sign' | 'document.reject'
  | 'certificate.suspend' | 'certificate.reinstate' | 'certificate.revoke'
  | 'registration.decide' | 'user.manage' | 'records.viewAll';
export interface Actor {
  userId: string;
  role: Role;
  assignmentStatus: AuthorisationStatus;
  scopeCodes: string[];
  authorisedFrom?: Date;
  authorisedUntil?: Date;
}
export interface WorkflowState { request: RequestStatus; document: DocumentStatus | null }
export type WorkflowEvent = 'PREPARE' | 'SUBMIT' | 'APPROVE' | 'RETURN' | 'SIGN' | 'REJECT';
export interface TransitionResult extends WorkflowState { effects: { createDraft?: true; bumpVersion?: true; issueCertificate?: true } }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
