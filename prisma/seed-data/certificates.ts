import type { Prisma } from '@prisma/client';
import { certificateNumber, draftNumber, requestNumber } from '../../src/domain/numbering';
import { computeDueDate } from '../../src/domain/sla';
import { addMonthsUtc, computeValidUntil } from '../../src/domain/validity';
import type { DocumentType, Priority, Role } from '../../src/domain/types';
import { VERIFICATION_CHECKLIST } from '../../src/domain/checklist';
import { DAY, atWorkHour, slaSpanMs, spreadTimes, type AuditRowInput } from './audit';
import type { Rng } from './prng';
import { documentFields, OBJECT_SCOPES, RETURN_COMMENTS, REVOKE_REASONS, SUSPEND_REASONS } from './requests';

export interface PoolUser {
  id: string;
  name: string;
  role: Role;
  scopes: readonly string[];
}

export interface ScopeRow {
  code: string;
  schemeCode: string;
  schemeLabel: string;
  documentType: string;
  termMonths: number;
}

export interface ClientRow {
  id: string;
  name: string;
  address: string;
}

export interface History {
  requests: Prisma.IssuanceRequestCreateManyInput[];
  documents: Prisma.DocumentCreateManyInput[];
  verifications: Prisma.VerificationResultCreateManyInput[];
  signatures: Prisma.SignatureCreateManyInput[];
  certificates: Prisma.CertificateCreateManyInput[];
  audits: AuditRowInput[];
  /** NumberSequence rows so that live numbering continues after the historical numbers. */
  sequences: { key: string; next: number }[];
}

const ALL_OK_JSON = JSON.stringify(Object.fromEntries(VERIFICATION_CHECKLIST.map((c) => [c.key, true])));

interface Item {
  idx: number;
  scope: ScopeRow;
  client: ClientRow;
  priority: Priority;
  phase: 'expiring' | 'expired' | 'active' | 'recent';
  issue: number;
  createdAt: number;
  returned: boolean;
  officer: PoolUser;
  verifier: PoolUser;
  signatory: PoolUser;
  objectScope: string;
}

/** Share of history requests issued after their due date (keeps the seeded SLA just above the 90% target). */
const LATE_SHARE = 0.041;

const eligible = (pool: PoolUser[], role: Role, scope: string) =>
  pool.filter((u) => u.role === role && u.scopes.includes(scope));

/**
 * Backdated issued requests with their documents, signatures, certificates and audit trail,
 * written as plain rows (a few hundred, too slow to drive one service call at a time).
 * Statuses follow the workflow table: request ISSUED / document SIGNED, optionally after
 * one return-for-revision round. Numbers come from in-memory per-key counters that are
 * handed back as NumberSequence rows, mirroring `nextSequence`.
 */
export function buildHistory(
  rng: Rng,
  now: Date,
  pool: PoolUser[],
  manager: PoolUser,
  scopes: ScopeRow[],
  clients: ClientRow[],
  count: number,
  /** How many of the first items are issued within the last 60 days (the rest are older). */
  recentCount: number,
  /** Pool user ids that get picked more often, so the demo users have visible history. */
  favourites: { officer: string; verifier: string; signatory: string },
): History & { certMeta: { id: string; phase: Item['phase']; issue: number; number: string; requestNo: string }[] } {
  const nowMs = now.getTime();
  const favour = (users: PoolUser[], id: string): PoolUser => users.find((u) => u.id === id && rng.chance(0.35)) ?? rng.pick(users);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const code = rng.weighted({ QMS: 30, ISMS: 18, INS: 22, CE: 15, CDKAB: 15 });
    const scope = scopes.find((s) => s.code === code)!;
    const term = scope.termMonths;
    const recent = i < recentCount;
    const phase: Item['phase'] = recent ? 'recent' : rng.weighted({ expiring: 7, expired: 10, active: 83 });
    let validUntil: number;
    if (phase === 'recent') validUntil = 0;
    else if (phase === 'expiring') validUntil = nowMs + rng.between(1, 27) * DAY;
    else if (phase === 'expired') validUntil = nowMs - rng.between(2, term === 12 ? 300 : 150) * DAY;
    else validUntil = nowMs + rng.between(32, term * 30 - 62) * DAY;
    const priority = rng.weighted({ NORMAL: 65, HIGH: 15, LOW: 20 });
    const span = slaSpanMs(priority, rng.chance(LATE_SHARE), rng);
    let issue: number;
    if (recent) issue = nowMs - rng.between(0.3, Math.max(0.6, 59.5 - span / DAY)) * DAY;
    else {
      issue = atWorkHour(addMonthsUtc(new Date(validUntil + DAY), -term).getTime(), rng).getTime();
      if (issue > nowMs - 61 * DAY) issue = atWorkHour(nowMs - (61 + rng.between(0, 20)) * DAY, rng).getTime();
    }
    const createdAt = issue - span;
    const officers = eligible(pool, 'ISSUANCE_OFFICER', scope.code);
    items.push({
      idx: i,
      scope,
      client: rng.pick(clients),
      priority,
      phase,
      issue,
      createdAt,
      returned: rng.chance(0.15),
      officer: favour(officers, favourites.officer),
      verifier: favour(eligible(pool, 'DOCUMENT_VERIFIER', scope.code), favourites.verifier),
      signatory: favour(eligible(pool, 'AUTHORISED_SIGNATORY', scope.code), favourites.signatory),
      objectScope: rng.pick(OBJECT_SCOPES[scope.code]!),
    });
  }

  // Numbers follow chronology: requests/drafts by creation date, certificates by issue date.
  const counters = new Map<string, number>();
  const alloc = (key: string) => {
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return n;
  };
  const year = (ms: number) => new Date(ms).getUTCFullYear();
  const reqNo = new Map<Item, string>();
  const drfNo = new Map<Item, string>();
  const certNo = new Map<Item, string>();
  for (const it of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    reqNo.set(it, requestNumber(year(it.createdAt), alloc(`REQ-${year(it.createdAt)}`)));
    drfNo.set(it, draftNumber(year(it.createdAt), alloc(`DRF-${year(it.createdAt)}`)));
  }
  for (const it of [...items].sort((a, b) => a.issue - b.issue)) {
    const y = year(it.issue);
    certNo.set(it, certificateNumber(it.scope.schemeCode, y, alloc(`CERT-${it.scope.schemeCode}-${y}`)));
  }

  const out: History = { requests: [], documents: [], verifications: [], signatures: [], certificates: [], audits: [], sequences: [] };
  const certMeta: { id: string; phase: Item['phase']; issue: number; number: string; requestNo: string }[] = [];

  for (const it of items) {
    const n = String(it.idx + 1).padStart(3, '0');
    const requestId = `seed-hreq-${n}`;
    const documentId = `seed-hdoc-${n}`;
    const certId = `seed-hcert-${n}`;
    const rNo = reqNo.get(it)!;
    const dNo = drfNo.get(it)!;
    const cNo = certNo.get(it)!;
    const type = it.scope.documentType as DocumentType;

    // Event timeline: create, prepare, edit, submit, [return, edit, submit], verify, sign.
    const steps = it.returned
      ? ['create', 'prepare', 'edit', 'submit', 'return', 'edit', 'submit', 'verify', 'sign']
      : ['create', 'prepare', 'edit', 'submit', 'verify', 'sign'];
    const times = spreadTimes(it.createdAt, it.issue, steps.length, rng);
    const at = (step: string, nth = 0) => {
      let seen = -1;
      for (let i = 0; i < steps.length; i++) if (steps[i] === step && ++seen === nth) return new Date(times[i]!);
      throw new Error('unknown step ' + step);
    };

    const fields = documentFields(
      type,
      { clientName: it.client.name, clientAddress: it.client.address, standard: it.scope.schemeLabel, objectScope: it.objectScope },
      it.createdAt + DAY,
      rng,
    );
    const returnComment = rng.pick(RETURN_COMMENTS);

    out.requests.push({
      id: requestId,
      number: rNo,
      clientId: it.client.id,
      scopeCode: it.scope.code,
      objectScope: it.objectScope,
      priority: it.priority,
      status: 'ISSUED',
      assigneeId: it.officer.id,
      createdById: it.officer.id,
      dueDate: computeDueDate(new Date(it.createdAt), it.priority),
      issuedAt: new Date(it.issue),
      createdAt: new Date(it.createdAt),
      updatedAt: new Date(it.issue),
    });
    out.documents.push({
      id: documentId,
      number: dNo,
      requestId,
      type,
      majorVersion: 1,
      minorVersion: it.returned ? 1 : 0,
      status: 'SIGNED',
      fieldsJson: JSON.stringify(fields),
      preparedById: it.officer.id,
      createdAt: at('prepare'),
      updatedAt: new Date(it.issue),
    });
    if (it.returned) {
      out.verifications.push({
        documentId,
        verifierId: it.verifier.id,
        outcome: 'RETURNED',
        checklistJson: JSON.stringify(Object.fromEntries(VERIFICATION_CHECKLIST.map((c, i) => [c.key, i % 3 !== 0]))),
        comment: returnComment,
        createdAt: at('return'),
      });
    }
    out.verifications.push({
      documentId,
      verifierId: it.verifier.id,
      outcome: 'APPROVED',
      checklistJson: ALL_OK_JSON,
      comment: rng.chance(0.3) ? 'Verified, no issues.' : null,
      createdAt: at('verify'),
    });
    out.signatures.push({ documentId, signerId: it.signatory.id, signedAt: new Date(it.issue) });
    out.certificates.push({
      id: certId,
      number: cNo,
      requestId,
      documentId,
      type,
      issueDate: new Date(it.issue),
      validUntil: computeValidUntil(new Date(it.issue), it.scope.termMonths),
      status: 'ACTIVE',
      statusReason: null,
      verificationToken: rng.hex(16),
      createdAt: new Date(it.issue),
    });
    certMeta.push({ id: certId, phase: it.phase, issue: it.issue, number: cNo, requestNo: rNo });

    const audit = (
      actor: PoolUser,
      action: string,
      entityType: string,
      entityId: string,
      entityLabel: string,
      when: Date,
      comment?: string,
    ) =>
      out.audits.push({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        entityType,
        entityId,
        entityLabel,
        comment: comment ?? null,
        at: when,
      });
    const editNote = `Updated: ${Object.keys(fields).join(', ')}`;
    audit(it.officer, 'request.create', 'REQUEST', requestId, rNo, at('create'));
    audit(it.officer, 'document.prepare', 'DOCUMENT', documentId, dNo, at('prepare'), `Draft prepared for ${rNo}`);
    audit(it.officer, 'document.edit', 'DOCUMENT', documentId, dNo, at('edit', 0), editNote);
    audit(it.officer, 'document.submit', 'DOCUMENT', documentId, dNo, at('submit', 0));
    if (it.returned) {
      audit(it.verifier, 'document.return', 'DOCUMENT', documentId, dNo, at('return'), returnComment);
      audit(it.officer, 'document.edit', 'DOCUMENT', documentId, dNo, at('edit', 1), 'Updated: scopeStatement');
      audit(it.officer, 'document.submit', 'DOCUMENT', documentId, dNo, at('submit', 1));
    }
    audit(it.verifier, 'document.verify', 'DOCUMENT', documentId, dNo, at('verify'));
    audit(it.signatory, 'document.sign', 'DOCUMENT', documentId, dNo, at('sign'), `Certificate ${cNo} issued`);
    audit(
      it.signatory,
      'certificate.issue',
      'CERTIFICATE',
      certId,
      cNo,
      new Date(it.issue + 1),
      `Issued from ${dNo} for ${rNo}`,
    );
  }

  // Lifecycle states: 8 suspended, 4 revoked, 12 in renewal (mostly the ones about to expire).
  const byPhase = (p: Item['phase']) => rng.shuffle(certMeta.filter((c) => c.phase === p));
  const expiring = byPhase('expiring');
  const active = byPhase('active');
  const renewal = [...expiring.slice(0, 8), ...active.splice(0, 12 - Math.min(8, expiring.length))];
  const suspended = active.splice(0, 8);
  const revoked = active.splice(0, 4);
  const setStatus = (ids: { id: string; issue: number; number: string }[], status: string, reasons: string[] | null, action: string | null) => {
    for (const m of ids) {
      const row = out.certificates.find((c) => c.id === m.id)!;
      row.status = status;
      if (!reasons) continue;
      const reason = rng.pick(reasons);
      row.statusReason = reason;
      const when = Math.min(nowMs - 2 * DAY, m.issue + rng.between(30, 400) * DAY);
      out.audits.push({
        actorId: manager.id,
        actorRole: manager.role,
        action: action!,
        entityType: 'CERTIFICATE',
        entityId: m.id,
        entityLabel: m.number,
        comment: reason,
        at: new Date(when),
      });
    }
  };
  setStatus(renewal, 'IN_RENEWAL', null, null);
  setStatus(suspended, 'SUSPENDED', SUSPEND_REASONS, 'certificate.suspend');
  setStatus(revoked, 'REVOKED', REVOKE_REASONS, 'certificate.revoke');

  out.sequences = [...counters.entries()].map(([key, c]) => ({ key, next: c + 1 }));
  return { ...out, certMeta };
}
