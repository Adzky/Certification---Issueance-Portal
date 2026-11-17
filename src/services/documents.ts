import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/repositories/prisma';
import { nextSequence } from '@/repositories/sequences';
import { VERIFICATION_CHECKLIST } from '@/domain/checklist';
import { DomainError } from '@/domain/errors';
import { draftNumber, sequenceKey } from '@/domain/numbering';
import { assertCan } from '@/domain/permissions';
import { missingRequiredFields, TEMPLATE_FIELDS } from '@/domain/templates';
import type {
  Actor,
  DocumentStatus,
  DocumentType,
  RequestStatus,
  TransitionResult,
  WorkflowEvent,
} from '@/domain/types';
import { canEditDocument, nextState } from '@/domain/workflow';
import { recordAudit } from './audit';
import { issueCertificate } from './certificates';
import { parseInput } from './context';
import { loadDocumentDetail } from './documentQueries';
import { certificateInclude, parseJsonRecord, toCertificateDetail, type CertificateDetail, type DocumentDetail } from './dto';
import { notify } from './notifications';

// Read side lives in documentQueries.ts; re-exported so callers import one module.
export { getDocument, listDocuments, type DocumentQueue } from './documentQueries';

const loadInclude = { request: { include: { scope: true, client: true } } } satisfies Prisma.DocumentInclude;
type LoadedDocument = Prisma.DocumentGetPayload<{ include: typeof loadInclude }>;

async function loadDocument(tx: Tx, id: string): Promise<LoadedDocument> {
  const doc = await tx.document.findUnique({ where: { id }, include: loadInclude });
  if (!doc) throw new DomainError('NOT_FOUND', 'Document not found');
  return doc;
}

const plan = (doc: LoadedDocument, event: WorkflowEvent): TransitionResult =>
  nextState({ request: doc.request.status as RequestStatus, document: doc.status as DocumentStatus }, event);

/** Applies a planned transition with status-guarded writes; a lost race is CONFLICT. */
async function applyTransition(
  tx: Tx,
  doc: LoadedDocument,
  next: TransitionResult,
  extra: Prisma.DocumentUpdateManyMutationInput = {},
): Promise<void> {
  const data: Prisma.DocumentUpdateManyMutationInput = { ...extra, status: next.document! };
  if (next.effects.bumpVersion) data.minorVersion = { increment: 1 };
  const d = await tx.document.updateMany({ where: { id: doc.id, status: doc.status }, data });
  const r = await tx.issuanceRequest.updateMany({
    where: { id: doc.requestId, status: doc.request.status },
    data: { status: next.request },
  });
  if (d.count === 0 || r.count === 0) {
    throw new DomainError('CONFLICT', `Document ${doc.number} was changed by someone else; reload and retry`);
  }
}

const label = (doc: LoadedDocument) => `${doc.number} (${doc.request.number}, ${doc.request.client.name})`;

function prefill(type: DocumentType, r: LoadedDocument['request']): Record<string, string> {
  const fields: Record<string, string> = Object.fromEntries(TEMPLATE_FIELDS[type].map((f) => [f.key, '']));
  fields.clientName = r.client.name;
  if (type === 'CERTIFICATE') {
    fields.clientAddress = r.client.address ?? '';
    fields.standard = r.scope.schemeLabel;
    fields.scopeStatement = r.objectScope;
  } else {
    fields.objectDescription = r.objectScope;
    fields.inspectionLocation = r.client.address ?? '';
  }
  return fields;
}

export async function prepareDocument(actor: Actor, requestId: string): Promise<DocumentDetail> {
  const id = await prisma.$transaction(async (tx) => {
    const request = await tx.issuanceRequest.findUnique({
      where: { id: requestId },
      include: { scope: true, client: true, documents: { select: { status: true } } },
    });
    if (!request) throw new DomainError('NOT_FOUND', 'Request not found');
    assertCan(actor, 'document.prepare', request.scopeCode);
    // At most one non-rejected draft exists; otherwise the latest state is REJECTED (or none).
    const live = request.documents.find((d) => d.status !== 'REJECTED');
    const docState = (live?.status ?? (request.documents.length ? 'REJECTED' : null)) as DocumentStatus | null;
    const next = nextState({ request: request.status as RequestStatus, document: docState }, 'PREPARE');
    const guard = await tx.issuanceRequest.updateMany({
      where: { id: request.id, status: request.status, updatedAt: request.updatedAt },
      data: { status: next.request },
    });
    if (guard.count === 0) throw new DomainError('CONFLICT', `Request ${request.number} was changed; reload and retry`);

    const year = new Date().getUTCFullYear();
    const type = request.scope.documentType as DocumentType;
    const doc = await tx.document.create({
      data: {
        number: draftNumber(year, await nextSequence(tx, sequenceKey('DRF', year))),
        requestId: request.id,
        type,
        status: next.document!,
        fieldsJson: JSON.stringify(prefill(type, request)),
        preparedById: actor.userId,
      },
    });
    await recordAudit(tx, {
      actor,
      action: 'document.prepare',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      entityLabel: doc.number,
      comment: `Draft prepared for ${request.number}`,
    });
    return doc.id;
  });
  return loadDocumentDetail(prisma, id);
}

const fieldsSchema = z.record(z.string(), z.string().max(5000, 'Field is too long'));

export async function updateDocumentFields(
  actor: Actor,
  documentId: string,
  fields: Record<string, string>,
): Promise<DocumentDetail> {
  await prisma.$transaction(async (tx) => {
    const doc = await loadDocument(tx, documentId);
    assertCan(actor, 'document.edit', doc.request.scopeCode);
    if (!canEditDocument(doc.status as DocumentStatus)) {
      throw new DomainError('INVALID_TRANSITION', `Document ${doc.number} cannot be edited while ${doc.status}`);
    }
    const input = parseInput(fieldsSchema, fields);
    const allowed = new Set(TEMPLATE_FIELDS[doc.type as DocumentType].map((f) => f.key));
    const unknown = Object.keys(input).filter((k) => !allowed.has(k));
    if (unknown.length) throw new DomainError('VALIDATION', `Unknown field(s): ${unknown.join(', ')}`);

    const merged = { ...parseJsonRecord<string>(doc.fieldsJson), ...input };
    const r = await tx.document.updateMany({
      where: { id: doc.id, status: doc.status },
      data: { fieldsJson: JSON.stringify(merged) },
    });
    if (r.count === 0) throw new DomainError('CONFLICT', `Document ${doc.number} was changed; reload and retry`);
    await recordAudit(tx, {
      actor,
      action: 'document.edit',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      entityLabel: doc.number,
      comment: `Updated: ${Object.keys(input).join(', ')}`,
    });
  });
  return loadDocumentDetail(prisma, documentId);
}

export async function submitDocument(actor: Actor, documentId: string): Promise<DocumentDetail> {
  await prisma.$transaction(async (tx) => {
    const doc = await loadDocument(tx, documentId);
    assertCan(actor, 'document.submit', doc.request.scopeCode);
    const next = plan(doc, 'SUBMIT');
    const missing = missingRequiredFields(doc.type as DocumentType, parseJsonRecord<string>(doc.fieldsJson));
    if (missing.length) throw new DomainError('VALIDATION', `Required field(s) empty: ${missing.join(', ')}`);
    await applyTransition(tx, doc, next);
    await recordAudit(tx, { actor, action: 'document.submit', entityType: 'DOCUMENT', entityId: doc.id, entityLabel: doc.number });
    await notify(tx, {
      recipientRole: 'DOCUMENT_VERIFIER',
      message: `Document ${label(doc)} is awaiting verification`,
      link: `/verification?doc=${doc.id}`,
    });
  });
  return loadDocumentDetail(prisma, documentId);
}

const checklistSchema = z.record(z.string(), z.boolean());

function parseChecklist(raw: unknown): Record<string, boolean> {
  const checklist = parseInput(checklistSchema, raw ?? {});
  const known = new Set(VERIFICATION_CHECKLIST.map((c) => c.key));
  const unknown = Object.keys(checklist).filter((k) => !known.has(k));
  if (unknown.length) throw new DomainError('VALIDATION', `Unknown checklist item(s): ${unknown.join(', ')}`);
  return checklist;
}

export async function verifyDocument(
  actor: Actor,
  documentId: string,
  input: { checklist: Record<string, boolean>; comment?: string },
): Promise<DocumentDetail> {
  await prisma.$transaction(async (tx) => {
    const doc = await loadDocument(tx, documentId);
    assertCan(actor, 'document.verify', doc.request.scopeCode);
    const next = plan(doc, 'APPROVE');
    const checklist = parseChecklist(input?.checklist);
    const unchecked = VERIFICATION_CHECKLIST.filter((c) => checklist[c.key] !== true).map((c) => c.label);
    if (unchecked.length) throw new DomainError('VALIDATION', `Checklist incomplete: ${unchecked.join('; ')}`);
    const comment = parseInput(z.string().trim().max(2000).optional(), input?.comment) || undefined;

    await applyTransition(tx, doc, next);
    await tx.verificationResult.create({
      data: {
        documentId: doc.id,
        verifierId: actor.userId,
        outcome: 'APPROVED',
        checklistJson: JSON.stringify(checklist),
        comment: comment ?? null,
      },
    });
    await recordAudit(tx, { actor, action: 'document.verify', entityType: 'DOCUMENT', entityId: doc.id, entityLabel: doc.number, comment });
    await notify(tx, {
      recipientRole: 'AUTHORISED_SIGNATORY',
      message: `Document ${label(doc)} is verified and ready for signing`,
      link: `/signing?doc=${doc.id}`,
    });
  });
  return loadDocumentDetail(prisma, documentId);
}

const requiredText = (what: string) => z.string({ error: `${what} is required` }).trim().min(1, `${what} is required`).max(2000);

export async function returnDocument(
  actor: Actor,
  documentId: string,
  input: { checklist: Record<string, boolean>; comment: string },
): Promise<DocumentDetail> {
  await prisma.$transaction(async (tx) => {
    const doc = await loadDocument(tx, documentId);
    assertCan(actor, 'document.return', doc.request.scopeCode);
    const next = plan(doc, 'RETURN');
    const checklist = parseChecklist(input?.checklist);
    const comment = parseInput(requiredText('Comment'), input?.comment);

    await applyTransition(tx, doc, next);
    await tx.verificationResult.create({
      data: {
        documentId: doc.id,
        verifierId: actor.userId,
        outcome: 'RETURNED',
        checklistJson: JSON.stringify(checklist),
        comment,
      },
    });
    await recordAudit(tx, { actor, action: 'document.return', entityType: 'DOCUMENT', entityId: doc.id, entityLabel: doc.number, comment });
    await notify(tx, {
      recipientUserId: doc.preparedById,
      message: `Document ${label(doc)} was returned for revision: ${comment}`,
      link: `/drafts/${doc.id}/edit`,
    });
  });
  return loadDocumentDetail(prisma, documentId);
}

export async function signDocument(
  actor: Actor,
  documentId: string,
): Promise<{ document: DocumentDetail; certificate: CertificateDetail }> {
  const certificateId = await prisma.$transaction(async (tx) => {
    const doc = await loadDocument(tx, documentId);
    assertCan(actor, 'document.sign', doc.request.scopeCode);
    const next = plan(doc, 'SIGN');
    await applyTransition(tx, doc, next);

    const signedAt = new Date();
    await tx.signature.create({ data: { documentId: doc.id, signerId: actor.userId, signedAt } });
    const cert = await issueCertificate(tx, { request: doc.request, document: doc, scope: doc.request.scope, signedAt });
    await recordAudit(tx, {
      actor,
      action: 'document.sign',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      entityLabel: doc.number,
      comment: `Certificate ${cert.number} issued`,
    });
    await recordAudit(tx, {
      actor,
      action: 'certificate.issue',
      entityType: 'CERTIFICATE',
      entityId: cert.id,
      entityLabel: cert.number,
      comment: `Issued from ${doc.number} for ${doc.request.number}`,
    });
    const message = `Certificate ${cert.number} issued for ${doc.request.number} (${doc.request.client.name})`;
    const link = `/certificates?id=${cert.id}`;
    await notify(tx, { recipientUserId: doc.preparedById, message, link });
    await notify(tx, { recipientRole: 'ISSUANCE_MANAGER', message, link });
    return cert.id;
  });
  const [document, cert] = await Promise.all([
    loadDocumentDetail(prisma, documentId),
    prisma.certificate.findUniqueOrThrow({ where: { id: certificateId }, include: certificateInclude }),
  ]);
  return { document, certificate: toCertificateDetail(cert) };
}

export async function rejectDocument(
  actor: Actor,
  documentId: string,
  input: { reason: string },
): Promise<DocumentDetail> {
  await prisma.$transaction(async (tx) => {
    const doc = await loadDocument(tx, documentId);
    assertCan(actor, 'document.reject', doc.request.scopeCode);
    const next = plan(doc, 'REJECT');
    const reason = parseInput(requiredText('Reason'), input?.reason);

    await applyTransition(tx, doc, next);
    await recordAudit(tx, { actor, action: 'document.reject', entityType: 'DOCUMENT', entityId: doc.id, entityLabel: doc.number, comment: reason });
    await notify(tx, {
      recipientUserId: doc.preparedById,
      message: `Document ${label(doc)} was rejected by the signatory: ${reason}`,
      link: `/requests?id=${doc.requestId}`,
    });
  });
  return loadDocumentDetail(prisma, documentId);
}
