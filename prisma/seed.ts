/**
 * Demo data. `seed(db, now)` expects an empty database (use `truncateAll` first) and is
 * deterministic: PRNG seed 42, every date relative to `now`.
 *
 * - ~120 recent requests are driven through the real services (createRequest,
 *   prepareDocument, ..., signDocument), so they obey the workflow state machine, then
 *   their timestamps are backdated across the last 60 days. The services use the shared
 *   `prisma` singleton, so `db` must point at the same database.
 * - ~380 older issued requests / certificates (up to 3 years back) are bulk-inserted as
 *   plain rows with the same statuses and numbering scheme (see seed-data/certificates.ts).
 *
 * CLI: `node node_modules/tsx/dist/cli.mjs prisma/seed.ts [--reset]`
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { VERIFICATION_CHECKLIST } from '../src/domain/checklist';
import { computeDueDate } from '../src/domain/sla';
import { computeValidUntil } from '../src/domain/validity';
import { REQUIRED_CONTROL_DOCUMENTS } from '../src/domain/registration';
import type { Actor, DocumentType } from '../src/domain/types';
import { createRequest } from '../src/services/requests';
import {
  prepareDocument,
  rejectDocument,
  returnDocument,
  signDocument,
  submitDocument,
  updateDocumentFields,
  verifyDocument,
} from '../src/services/documents';
import { submitRegistration } from '../src/services/registrations';
import { DAY, HOUR, fitToSla, slaSpanMs, spreadTimes } from './seed-data/audit';
import { buildHistory, type ClientRow, type PoolUser, type ScopeRow } from './seed-data/certificates';
import { CLIENTS } from './seed-data/clients';
import { minimalPdf } from './seed-data/pdf';
import { createRng, type Rng } from './seed-data/prng';
import {
  AGE_DAYS,
  buildFlowSpecs,
  documentFields,
  OBJECT_SCOPES,
  OUTCOME_COUNTS,
  partialFields,
  REJECT_REASONS,
  RETURN_COMMENTS,
  type FlowSpec,
} from './seed-data/requests';
import { emailFor, PENDING_APPLICANT, POSITION, SERVICE_SCOPES, USERS } from './seed-data/users';

const TOTAL_CERTIFICATES = 450;
const ALL_OK: Record<string, boolean> = Object.fromEntries(VERIFICATION_CHECKLIST.map((c) => [c.key, true]));

async function inChunks<T>(rows: T[], size: number, write: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
}

const actorOf = (u: PoolUser): Actor => ({ userId: u.id, role: u.role, assignmentStatus: 'ACTIVE', scopeCodes: [...u.scopes] });

interface Plan {
  spec: FlowSpec;
  createdAt: number;
  /** Time of the last event (the issue time for issued requests). */
  endAt: number;
  issued: boolean;
  officer: PoolUser;
  verifier: PoolUser;
  signatory: PoolUser;
  client: ClientRow;
  objectScope: string;
}

export async function seed(db: PrismaClient, now: Date): Promise<void> {
  const rng = createRng(42);
  const nowMs = now.getTime();

  // ---- reference data, users ----
  const scopes: ScopeRow[] = SERVICE_SCOPES.map((s) => ({
    code: s.code,
    schemeCode: s.code,
    schemeLabel: s.schemeLabel,
    documentType: s.documentType,
    termMonths: s.termMonths,
  }));
  await db.serviceScope.createMany({ data: SERVICE_SCOPES.map((s) => ({ ...s, schemeCode: s.code })) });

  const clients: ClientRow[] = CLIENTS.map((c, i) => ({ id: `seed-client-${String(i + 1).padStart(2, '0')}`, ...c }));
  await db.client.createMany({ data: clients });

  const idOf = new Map<string, string>();
  const pool: PoolUser[] = [];
  const userRows = USERS.map((u, i) => {
    const id = `seed-user-${String(i + 1).padStart(2, '0')}`;
    idOf.set(u.key, id);
    if (u.status === 'ACTIVE') pool.push({ id, name: u.name, role: u.role, scopes: u.scopes });
    return {
      id,
      name: u.name,
      email: emailFor(u.name),
      employeeId: `JMU-${String(i + 1).padStart(5, '0')}`,
      phone: `+62 8${rng.int(11, 99)}-${rng.int(1000, 9999)}-${rng.int(1000, 9999)}`,
      position: POSITION[u.role].position,
      unit: POSITION[u.role].unit,
      createdAt: new Date(nowMs - rng.between(150, 720) * DAY),
    };
  });
  await db.user.createMany({ data: userRows });
  const authoriser = idOf.get('rina')!;
  await db.roleAssignment.createMany({
    data: USERS.map((u, i) => {
      const from = userRows[i]!.createdAt;
      return {
        id: `seed-ra-${String(i + 1).padStart(2, '0')}`,
        userId: idOf.get(u.key)!,
        role: u.role,
        status: u.status,
        authorisedFrom: from,
        authorisedUntil: new Date(nowMs + rng.between(120, 700) * DAY),
        authorisedById: u.key === 'rina' ? idOf.get('fajar')! : authoriser,
      };
    }),
  });
  await db.roleAssignmentScope.createMany({
    data: USERS.flatMap((u, i) =>
      u.scopes.map((scopeCode) => ({ assignmentId: `seed-ra-${String(i + 1).padStart(2, '0')}`, scopeCode })),
    ),
  });
  const manager = pool.find((u) => u.role === 'ISSUANCE_MANAGER' && u.id === authoriser)!;

  // ---- historical issued requests and certificates (bulk rows) ----
  const specs = buildFlowSpecs(rng);
  const recentIssued = specs.filter((s) => s.outcome.startsWith('ISSUED')).length;
  const history = buildHistory(
    rng,
    now,
    pool,
    manager,
    scopes,
    clients,
    TOTAL_CERTIFICATES - recentIssued,
    OUTCOME_COUNTS.ISSUED,
    { officer: idOf.get('andi')!, verifier: idOf.get('dewi')!, signatory: idOf.get('budi')! },
  );
  await inChunks(history.requests, 200, (data) => db.issuanceRequest.createMany({ data }));
  await inChunks(history.documents, 200, (data) => db.document.createMany({ data }));
  await inChunks(history.verifications, 200, (data) => db.verificationResult.createMany({ data }));
  await inChunks(history.signatures, 200, (data) => db.signature.createMany({ data }));
  await inChunks(history.certificates, 200, (data) => db.certificate.createMany({ data }));
  await inChunks(history.audits, 200, (data) => db.auditLog.createMany({ data }));
  await db.numberSequence.createMany({ data: history.sequences });

  // ---- recent requests, driven through the services ----
  const plans = planFlows(rng, now, specs, pool, clients, idOf);
  for (const plan of plans) await runFlow(db, rng, now, plan, scopes);

  // ---- one pending registration for the manager to approve ----
  await seedRegistration(db, now);

  // Completion marker, written last: scripts/ensure-db.mjs reseeds a database that lacks it.
  await db.numberSequence.create({ data: { key: '__seed_complete__', next: 1 } });
}

function planFlows(
  rng: Rng,
  now: Date,
  specs: FlowSpec[],
  pool: PoolUser[],
  clients: ClientRow[],
  idOf: Map<string, string>,
): Plan[] {
  const nowMs = now.getTime();
  const dewi = idOf.get('dewi')!;
  const budi = idOf.get('budi')!;
  const andi = idOf.get('andi')!;
  const pickWith = (role: PoolUser['role'], scope: string, favourite?: string): PoolUser => {
    const options = pool.filter((u) => u.role === role && u.scopes.includes(scope));
    const fav = options.find((u) => u.id === favourite);
    return fav && rng.chance(0.4) ? fav : rng.pick(options);
  };
  const plans = specs.map((spec): Plan => {
    const issued = spec.outcome.startsWith('ISSUED');
    let createdAt: number;
    let endAt: number;
    if (issued) {
      const late = rng.chance(spec.outcome === 'ISSUED' ? 0.1 : 0.3);
      const span = slaSpanMs(spec.priority, late, rng);
      const age = rng.between(0.3, Math.max(0.6, 59.5 - span / DAY));
      endAt = nowMs - age * DAY;
      createdAt = fitToSla(endAt - span, endAt, spec.priority, late);
    } else {
      const [lo, hi] = AGE_DAYS[spec.outcome as keyof typeof AGE_DAYS];
      createdAt = nowMs - (spec.ageDays ?? rng.between(lo, hi)) * DAY;
      endAt = createdAt + (nowMs - createdAt) * rng.between(0.55, 0.95);
    }
    const officer = spec.officerKey
      ? pool.find((u) => u.id === idOf.get(spec.officerKey!))!
      : pickWith('ISSUANCE_OFFICER', spec.scopeCode, andi);
    return {
      spec,
      createdAt,
      endAt,
      issued,
      officer,
      verifier: pickWith('DOCUMENT_VERIFIER', spec.scopeCode, dewi),
      signatory: pickWith('AUTHORISED_SIGNATORY', spec.scopeCode, budi),
      client: rng.pick(clients),
      objectScope: rng.pick(OBJECT_SCOPES[spec.scopeCode]!),
    };
  });
  // Request numbers should increase with creation date.
  return plans.sort((a, b) => a.createdAt - b.createdAt);
}

async function runFlow(db: PrismaClient, rng: Rng, now: Date, plan: Plan, scopes: ScopeRow[]): Promise<void> {
  const { spec, officer, verifier, signatory } = plan;
  const scope = scopes.find((s) => s.code === spec.scopeCode)!;
  const type = scope.documentType as DocumentType;
  const o = actorOf(officer);
  const v = actorOf(verifier);
  const s = actorOf(signatory);
  const full = documentFields(
    type,
    { clientName: plan.client.name, clientAddress: plan.client.address, standard: scope.schemeLabel, objectScope: plan.objectScope },
    plan.createdAt + DAY,
    rng,
  );
  const touchKey = type === 'CERTIFICATE' ? 'scopeStatement' : 'findings';
  const oldNotifs = new Set((await db.notification.findMany({ select: { id: true } })).map((n) => n.id));

  const created = await createRequest(o, {
    clientId: plan.client.id,
    scopeCode: spec.scopeCode,
    objectScope: plan.objectScope,
    priority: spec.priority,
  });
  const outcome = spec.outcome;
  if (outcome !== 'SUBMITTED') {
    let doc = await prepareDocument(o, created.id);
    const draftOnly = async () => {
      const mode = rng.weighted({ none: 2, partial: 6, full: 2 });
      if (mode === 'full') await updateDocumentFields(o, doc.id, full);
      else if (mode === 'partial') {
        const part = partialFields(type, full, rng);
        if (Object.keys(part).length) await updateDocumentFields(o, doc.id, part);
      }
    };
    if (outcome === 'DRAFT') {
      await draftOnly();
    } else {
      await updateDocumentFields(o, doc.id, full);
      await submitDocument(o, doc.id);
      if (outcome === 'REVISION' || outcome === 'ISSUED_RETURNED') {
        const checklist = Object.fromEntries(VERIFICATION_CHECKLIST.map((c, i) => [c.key, i % 3 !== 0]));
        await returnDocument(v, doc.id, { checklist, comment: rng.pick(RETURN_COMMENTS) });
      }
      if (outcome === 'ISSUED_RETURNED') {
        await updateDocumentFields(o, doc.id, { [touchKey]: full[touchKey]! });
        await submitDocument(o, doc.id);
      }
      if (outcome !== 'IN_VERIFICATION' && outcome !== 'REVISION') {
        await verifyDocument(v, doc.id, { checklist: ALL_OK, comment: rng.chance(0.3) ? 'Verified, no issues.' : undefined });
        if (outcome === 'DRAFT_REJECTED' || outcome === 'ISSUED_REJECTED') {
          await rejectDocument(s, doc.id, { reason: rng.pick(REJECT_REASONS) });
          doc = await prepareDocument(o, created.id);
          if (outcome === 'DRAFT_REJECTED') await draftOnly();
          else {
            await updateDocumentFields(o, doc.id, full);
            await submitDocument(o, doc.id);
            await verifyDocument(v, doc.id, { checklist: ALL_OK });
          }
        }
        if (plan.issued) await signDocument(s, doc.id);
      }
    }
  }

  await backdate(db, rng, now, plan, scope, created.id, oldNotifs);
}

/** Rewrites the timestamps of one request's rows so the history spans `plan.createdAt` .. `plan.endAt`. */
async function backdate(
  db: PrismaClient,
  rng: Rng,
  now: Date,
  plan: Plan,
  scope: ScopeRow,
  requestId: string,
  oldNotifs: Set<string>,
): Promise<void> {
  const [docs, cert] = await Promise.all([
    db.document.findMany({ where: { requestId }, select: { id: true } }),
    db.certificate.findUnique({ where: { requestId }, select: { id: true } }),
  ]);
  const docIds = docs.map((d) => d.id);
  const audits = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'REQUEST', entityId: requestId },
        { entityType: 'DOCUMENT', entityId: { in: docIds } },
        ...(cert ? [{ entityType: 'CERTIFICATE', entityId: cert.id }] : []),
      ],
    },
    orderBy: [{ at: 'asc' }, { id: 'asc' }],
  });
  const n = audits.length;
  // Issued: the last two rows (sign, certificate.issue) share the issue time.
  const times = plan.issued
    ? [...spreadTimes(plan.createdAt, plan.endAt, n - 1, rng), plan.endAt + 1]
    : spreadTimes(plan.createdAt, plan.endAt, n, rng);
  const timeOf = new Map(audits.map((a, i) => [a.id, times[i]!]));

  const [results, notifs] = await Promise.all([
    db.verificationResult.findMany({ where: { documentId: { in: docIds } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.notification.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ]);
  const newNotifs = notifs.filter((x) => !oldNotifs.has(x.id));
  const verdictTimes = audits.filter((a) => a.action === 'document.verify' || a.action === 'document.return').map((a) => timeOf.get(a.id)!);
  // submit, verify, return and reject notify once; sign notifies twice (preparer and managers).
  const notifyTimes = audits.flatMap((a) =>
    a.action === 'document.sign'
      ? [timeOf.get(a.id)!, timeOf.get(a.id)!]
      : ['document.submit', 'document.verify', 'document.return', 'document.reject'].includes(a.action)
        ? [timeOf.get(a.id)!]
        : [],
  );

  const lastTime = times[n - 1]!;
  const ops: Prisma.PrismaPromise<unknown>[] = [
    ...audits.map((a) => db.auditLog.update({ where: { id: a.id }, data: { at: new Date(timeOf.get(a.id)!) } })),
    db.issuanceRequest.update({
      where: { id: requestId },
      data: {
        createdAt: new Date(plan.createdAt),
        dueDate: computeDueDate(new Date(plan.createdAt), plan.spec.priority),
        updatedAt: new Date(lastTime),
        ...(plan.issued ? { issuedAt: new Date(plan.endAt) } : {}),
      },
    }),
    ...docIds.map((id) => {
      const mine = audits.filter((a) => a.entityType === 'DOCUMENT' && a.entityId === id);
      const prepared = mine.find((a) => a.action === 'document.prepare')!;
      return db.document.update({
        where: { id },
        data: { createdAt: new Date(timeOf.get(prepared.id)!), updatedAt: new Date(timeOf.get(mine[mine.length - 1]!.id)!) },
      });
    }),
    ...results.map((r, i) => db.verificationResult.update({ where: { id: r.id }, data: { createdAt: new Date(verdictTimes[i] ?? plan.endAt) } })),
    ...newNotifs.map((x, i) => {
      const t = notifyTimes[i] ?? lastTime;
      return db.notification.update({ where: { id: x.id }, data: { createdAt: new Date(t), read: t < now.getTime() - 2 * DAY } });
    }),
  ];
  if (cert) {
    const issued = new Date(plan.endAt);
    ops.push(
      db.signature.updateMany({ where: { documentId: { in: docIds } }, data: { signedAt: issued } }),
      db.certificate.update({
        where: { id: cert.id },
        data: { issueDate: issued, createdAt: issued, validUntil: computeValidUntil(issued, scope.termMonths) },
      }),
    );
  }
  await db.$transaction(ops);
}

async function seedRegistration(db: PrismaClient, now: Date): Promise<void> {
  const p = PENDING_APPLICANT;
  const before = new Set((await db.notification.findMany({ select: { id: true } })).map((n) => n.id));
  const { applicationId, userId } = await submitRegistration({
    role: p.role,
    scopes: p.scopes,
    personal: {
      fullName: p.name,
      employeeId: p.employeeId,
      nationalId: p.nationalId,
      position: p.position,
      unit: p.unit,
      email: p.email,
      phone: p.phone,
    },
    employment: {
      education: p.education,
      fieldOfStudy: p.fieldOfStudy,
      experienceYears: p.experienceYears,
      employmentStatus: p.employmentStatus,
      startDate: '2019-03-01',
    },
    declarationAccepted: true,
    files: REQUIRED_CONTROL_DOCUMENTS.map((name, i) => ({
      slot: i + 1,
      fileName: `${i + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}.pdf`,
      bytes: minimalPdf(name),
    })),
  });
  const at = new Date(now.getTime() - 26 * HOUR);
  const fresh = (await db.notification.findMany({ select: { id: true } })).filter((n) => !before.has(n.id));
  await db.$transaction([
    db.registrationApplication.update({ where: { id: applicationId }, data: { createdAt: at } }),
    db.auditLog.updateMany({ where: { entityType: 'REGISTRATION', entityId: applicationId }, data: { at } }),
    db.user.update({ where: { id: userId }, data: { createdAt: at } }),
    ...fresh.map((n) => db.notification.update({ where: { id: n.id }, data: { createdAt: at } })),
  ]);
}

// ---- CLI ----
if (/[\\/]seed\.ts$/.test(process.argv[1] ?? '')) {
  void (async () => {
    const { prisma } = await import('../src/repositories/prisma');
    const started = Date.now();
    try {
      if (process.argv.includes('--reset')) {
        const { truncateAll } = await import('../src/repositories/truncate');
        await truncateAll(prisma);
      }
      await seed(prisma, new Date());
      const [users, requests, certificates] = await Promise.all([
        prisma.user.count(),
        prisma.issuanceRequest.count(),
        prisma.certificate.count(),
      ]);
      console.log(
        `Seeded ${users} users, ${requests} requests, ${certificates} certificates in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  })();
}
