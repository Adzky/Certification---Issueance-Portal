/**
 * REST contract types: the JSON shapes exchanged over `app/api/**` (documented in
 * `docs/api/openapi.yaml`). Pure types only — no runtime code, no Prisma — so the UI
 * and `src/api-client` can depend on them without depending on the backend
 * implementation. Services re-export these from `src/services/dto*.ts`.
 *
 * All dates are ISO-8601 strings.
 */
import type {
  Action,
  AuthorisationStatus,
  CertificateDisplayStatus,
  CertificateStatus,
  DocumentStatus,
  DocumentType,
  Page,
  Priority,
  RegistrationStatus,
  RequestStatus,
  Role,
} from '@/domain/types';

export type { Page } from '@/domain/types';

// ---------- Queries ----------

/** Shared list query accepted by every list endpoint (as query-string params). */
export interface ListQuery {
  q?: string;
  status?: string;
  scopeCode?: string;
  priority?: Priority;
  type?: DocumentType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export type DocumentQueue = 'verification' | 'signing' | 'returned' | 'verifiedByMe' | 'signedByMe';
export type DocumentListQuery = ListQuery & { queue?: DocumentQueue };
export type CertificateListQuery = ListQuery & { scheme?: string };
export type AuditListQuery = ListQuery & { entityType?: string; actorId?: string };
export type RegistrationListQuery = { status?: RegistrationStatus };

// ---------- Requests & documents ----------

export interface RequestSummary {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  scopeCode: string;
  scopeName: string;
  schemeLabel: string;
  documentType: DocumentType;
  objectScope: string;
  priority: Priority;
  status: RequestStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  dueDate: string;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: Role | null;
  comment: string | null;
  at: string;
}

export interface DocumentSummary {
  id: string;
  number: string;
  requestId: string;
  requestNumber: string;
  clientName: string;
  scopeCode: string;
  scopeName: string;
  priority: Priority;
  dueDate: string;
  type: DocumentType;
  version: string;
  status: DocumentStatus;
  preparedById: string;
  preparedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestDetail extends RequestSummary {
  clientAddress: string | null;
  documents: DocumentSummary[];
  timeline: TimelineEntry[];
  certificate: { id: string; number: string; status: CertificateStatus } | null;
}

export interface VerificationResultDto {
  id: string;
  verifierId: string;
  verifierName: string;
  outcome: 'APPROVED' | 'RETURNED';
  checklist: Record<string, boolean>;
  comment: string | null;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  fields: Record<string, string>;
  verifications: VerificationResultDto[];
  /** Comment of the most recent verification result (approve or return), if any. */
  latestVerifierComment: string | null;
  /** Signatory's reason, from the `document.reject` audit comment (REJECTED documents only). */
  rejectionReason: string | null;
  signature: { signerId: string; signerName: string; signedAt: string } | null;
  certificateId: string | null;
  request: RequestSummary;
}

export type StatusStats = Record<string, number>;
export type RequestPage = Page<RequestSummary> & { stats: StatusStats };
export type DocumentPage = Page<DocumentSummary> & { stats: StatusStats };

// ---------- Certificates ----------

export interface CertificateDetail {
  id: string;
  number: string;
  type: DocumentType;
  requestId: string;
  requestNumber: string;
  documentId: string;
  documentNumber: string;
  clientName: string;
  clientAddress: string | null;
  scopeCode: string;
  scopeName: string;
  schemeLabel: string;
  objectScope: string;
  issueDate: string;
  validUntil: string;
  status: CertificateStatus;
  displayStatus: CertificateDisplayStatus;
  statusReason: string | null;
  verificationToken: string;
  createdAt: string;
}

export interface CertificateSummary {
  id: string;
  number: string;
  type: DocumentType;
  requestNumber: string;
  clientName: string;
  scopeCode: string;
  scopeName: string;
  schemeCode: string;
  schemeLabel: string;
  issueDate: string;
  validUntil: string;
  status: CertificateStatus;
  displayStatus: CertificateDisplayStatus;
}

/** Public verification view: no internal ids, tokens or request data. */
export interface PublicCertificate {
  number: string;
  type: DocumentType;
  clientName: string;
  scopeName: string;
  schemeLabel: string;
  issueDate: string;
  validUntil: string;
  displayStatus: CertificateDisplayStatus;
}

export type CertificateStats = Record<CertificateDisplayStatus | 'TOTAL', number>;
export type CertificatePage = Page<CertificateSummary> & { stats: CertificateStats };
export interface SignResult {
  document: DocumentDetail;
  certificate: CertificateDetail;
}

// ---------- Registrations, users, login ----------

export interface RegistrationSummary {
  id: string;
  userId: string;
  applicantName: string;
  email: string;
  role: Role;
  requestedScopes: string[];
  status: RegistrationStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface RegistrationDetail extends RegistrationSummary {
  personal: {
    fullName: string;
    employeeId: string;
    nationalId: string;
    position: string;
    unit: string;
    email: string;
    phone: string;
  };
  employment: {
    education: string;
    fieldOfStudy: string;
    experienceYears: number;
    employmentStatus: 'PERMANENT' | 'CONTRACT';
    startDate: string;
  };
  declarationAccepted: boolean;
  documents: { slot: number; name: string; fileName: string; sizeBytes: number }[];
  decisionComment: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  assignmentStatus: AuthorisationStatus | null;
  authorisedFrom: string | null;
  authorisedUntil: string | null;
}

export interface RegistrationStatusInfo {
  status: RegistrationStatus;
  assignmentStatus: AuthorisationStatus;
  role: Role;
  scopes: string[];
  authorisedFrom?: string;
  authorisedUntil?: string;
  authorisedBy?: string;
}

export interface UserAssignment {
  assignmentId: string;
  role: Role;
  status: AuthorisationStatus;
  scopeCodes: string[];
  authorisedFrom: string | null;
  authorisedUntil: string | null;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  position: string | null;
  unit: string | null;
  assignments: UserAssignment[];
}

export interface LoginOption {
  role: Role;
  users: { userId: string; name: string; avatarUrl?: string; status: AuthorisationStatus }[];
}

/** GET /api/session. `permissions` is empty unless the assignment is ACTIVE or RESTRICTED. */
export interface SessionInfo {
  user: { id: string; name: string; email: string; avatarUrl: string | null; position: string | null; unit: string | null };
  role: Role;
  /** Roles this user may currently sign in as (ACTIVE or RESTRICTED assignments). */
  roles: Role[];
  assignmentStatus: AuthorisationStatus;
  scopeCodes: string[];
  permissions: Action[];
}

// ---------- Dashboard, audit, notifications, reference, permissions ----------

export type AuditEntry = TimelineEntry;

export interface DashboardData {
  role: Role;
  stats: { key: string; label: string; value: number; tone: 'blue' | 'amber' | 'green' | 'red' | 'purple' }[];
  queue: {
    id: string;
    number: string;
    client: string;
    scope: string;
    status: string;
    dueInDays?: number;
    link: string;
  }[];
  trend?: { label: string; issued: number; requested: number }[];
  statusBreakdown?: { status: string; count: number }[];
  sla?: { achievedPct: number; targetPct: 90 };
  recentActivity?: { at: string; text: string; ok: boolean }[];
}

export interface NotificationDto {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationDto[];
  unread: number;
}

export interface ServiceScopeDto {
  code: string;
  name: string;
  category: string;
  schemeLabel: string;
  schemeCode: string;
  documentType: DocumentType;
  termMonths: number;
}

export interface ReferenceData {
  clients: { id: string; name: string }[];
  scopes: ServiceScopeDto[];
  checklist: readonly { key: string; label: string }[];
}

export interface PermissionsMatrix {
  roles: { role: Role; label: string; actions: Action[] }[];
  actions: Action[];
}

// ---------- Request bodies ----------

export interface CreateRequestBody {
  clientId: string;
  scopeCode: string;
  objectScope: string;
  priority: Priority;
}
export interface UpdateDocumentBody {
  fields: Record<string, string>;
}
export interface VerifyBody {
  checklist: Record<string, boolean>;
  comment?: string;
}
export interface ReturnBody {
  checklist: Record<string, boolean>;
  comment: string;
}
export interface ReasonBody {
  reason: string;
}
export interface LoginBody {
  userId: string;
  role: Role;
}
export interface DecisionBody {
  decision: 'APPROVE' | 'REJECT';
  comment?: string;
  authorisedUntil?: string;
}
export interface UpdateAssignmentBody {
  status?: AuthorisationStatus;
  scopeCodes?: string[];
}
export interface MarkNotificationsReadBody {
  /** Omit to mark every visible notification read. */
  ids?: string[];
}
/** The JSON `payload` part of the multipart POST /api/registrations. Files go in parts `file1`..`file7`. */
export interface RegistrationPayload {
  role: Role;
  scopes: string[];
  personal: RegistrationDetail['personal'];
  employment: RegistrationDetail['employment'];
  declarationAccepted: true;
}
export interface RegistrationSubmitted {
  applicationId: string;
  userId: string;
}

// ---------- Errors ----------

export type ApiErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'INVALID_TRANSITION' | 'CONFLICT' | 'UNAUTHENTICATED' | 'INTERNAL';
export interface ErrorBody {
  error: { code: ApiErrorCode; message: string };
}
