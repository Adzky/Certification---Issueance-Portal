import type { Prisma } from '@prisma/client';
import { displayCertificateStatus } from '@/domain/validity';
import type {
  CertificateStatus,
  DocumentStatus,
  DocumentType,
  Priority,
  RequestStatus,
} from '@/domain/types';
import type {
  CertificateDetail,
  CertificateSummary,
  DocumentDetail,
  DocumentSummary,
  PublicCertificate,
  RequestSummary,
  VerificationResultDto,
} from '@/contract/types';

// Plain-JSON DTOs (dates are ISO strings) live in the backend-neutral REST contract.
export type {
  CertificateDetail,
  CertificateSummary,
  DocumentDetail,
  DocumentSummary,
  PublicCertificate,
  RequestDetail,
  RequestSummary,
  TimelineEntry,
  VerificationResultDto,
} from '@/contract/types';

// ---------- Prisma includes + mappers ----------

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);
export const versionLabel = (major: number, minor: number) => `v${major}.${minor}`;

export const requestInclude = {
  client: true,
  scope: true,
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.IssuanceRequestInclude;
export type RequestRow = Prisma.IssuanceRequestGetPayload<{ include: typeof requestInclude }>;

export function toRequestSummary(r: RequestRow): RequestSummary {
  return {
    id: r.id,
    number: r.number,
    clientId: r.clientId,
    clientName: r.client.name,
    scopeCode: r.scopeCode,
    scopeName: r.scope.name,
    schemeLabel: r.scope.schemeLabel,
    documentType: r.scope.documentType as DocumentType,
    objectScope: r.objectScope,
    priority: r.priority as Priority,
    status: r.status as RequestStatus,
    assigneeId: r.assigneeId,
    assigneeName: r.assignee?.name ?? null,
    createdById: r.createdById,
    dueDate: iso(r.dueDate),
    issuedAt: isoOrNull(r.issuedAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export const documentInclude = {
  request: { include: requestInclude },
  preparedBy: { select: { id: true, name: true } },
} satisfies Prisma.DocumentInclude;
export type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

export function toDocumentSummary(d: DocumentRow): DocumentSummary {
  return {
    id: d.id,
    number: d.number,
    requestId: d.requestId,
    requestNumber: d.request.number,
    clientName: d.request.client.name,
    scopeCode: d.request.scopeCode,
    scopeName: d.request.scope.name,
    priority: d.request.priority as Priority,
    dueDate: iso(d.request.dueDate),
    type: d.type as DocumentType,
    version: versionLabel(d.majorVersion, d.minorVersion),
    status: d.status as DocumentStatus,
    preparedById: d.preparedById,
    preparedByName: d.preparedBy.name,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

export const documentDetailInclude = {
  ...documentInclude,
  verifications: { include: { verifier: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
  signature: { include: { signer: { select: { name: true } } } },
  certificate: { select: { id: true } },
} satisfies Prisma.DocumentInclude;
export type DocumentDetailRow = Prisma.DocumentGetPayload<{ include: typeof documentDetailInclude }>;

export function parseJsonRecord<T>(json: string): Record<string, T> {
  try {
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {};
  } catch {
    return {};
  }
}

export function toDocumentDetail(d: DocumentDetailRow, rejectionReason: string | null): DocumentDetail {
  return {
    ...toDocumentSummary(d),
    fields: parseJsonRecord<string>(d.fieldsJson),
    verifications: d.verifications.map((v) => ({
      id: v.id,
      verifierId: v.verifierId,
      verifierName: v.verifier.name,
      outcome: v.outcome as VerificationResultDto['outcome'],
      checklist: parseJsonRecord<boolean>(v.checklistJson),
      comment: v.comment,
      createdAt: iso(v.createdAt),
    })),
    latestVerifierComment: d.verifications.at(-1)?.comment ?? null,
    rejectionReason,
    signature: d.signature
      ? { signerId: d.signature.signerId, signerName: d.signature.signer.name, signedAt: iso(d.signature.signedAt) }
      : null,
    certificateId: d.certificate?.id ?? null,
    request: toRequestSummary(d.request),
  };
}

export const certificateInclude = {
  request: { include: { client: true, scope: true } },
  document: { select: { number: true } },
} satisfies Prisma.CertificateInclude;
export type CertificateRow = Prisma.CertificateGetPayload<{ include: typeof certificateInclude }>;

export function toCertificateDetail(c: CertificateRow, now: Date = new Date()): CertificateDetail {
  const status = c.status as CertificateStatus;
  return {
    id: c.id,
    number: c.number,
    type: c.type as DocumentType,
    requestId: c.requestId,
    requestNumber: c.request.number,
    documentId: c.documentId,
    documentNumber: c.document.number,
    clientName: c.request.client.name,
    clientAddress: c.request.client.address,
    scopeCode: c.request.scopeCode,
    scopeName: c.request.scope.name,
    schemeLabel: c.request.scope.schemeLabel,
    objectScope: c.request.objectScope,
    issueDate: iso(c.issueDate),
    validUntil: iso(c.validUntil),
    status,
    displayStatus: displayCertificateStatus({ status, validUntil: c.validUntil }, now),
    statusReason: c.statusReason,
    verificationToken: c.verificationToken,
    createdAt: iso(c.createdAt),
  };
}

export function toCertificateSummary(c: CertificateRow, now: Date = new Date()): CertificateSummary {
  const status = c.status as CertificateStatus;
  return {
    id: c.id,
    number: c.number,
    type: c.type as DocumentType,
    requestNumber: c.request.number,
    clientName: c.request.client.name,
    scopeCode: c.request.scopeCode,
    scopeName: c.request.scope.name,
    schemeCode: c.request.scope.schemeCode,
    schemeLabel: c.request.scope.schemeLabel,
    issueDate: iso(c.issueDate),
    validUntil: iso(c.validUntil),
    status,
    displayStatus: displayCertificateStatus({ status, validUntil: c.validUntil }, now),
  };
}

export function toPublicCertificate(c: CertificateRow, now: Date = new Date()): PublicCertificate {
  return {
    number: c.number,
    type: c.type as DocumentType,
    clientName: c.request.client.name,
    scopeName: c.request.scope.name,
    schemeLabel: c.request.scope.schemeLabel,
    issueDate: iso(c.issueDate),
    validUntil: iso(c.validUntil),
    displayStatus: displayCertificateStatus({ status: c.status as CertificateStatus, validUntil: c.validUntil }, now),
  };
}
