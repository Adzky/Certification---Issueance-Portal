import type { Prisma } from '@prisma/client';
import { prisma } from '@/repositories/prisma';
import { assertCan } from '@/domain/permissions';
import { isDueSoon, isSlaAchieved } from '@/domain/sla';
import type { Actor, RequestStatus } from '@/domain/types';
import { actionableScopes } from './context';
import type { DashboardData } from './dtoAdmin';

/** Static platform uptime shown on the admin dashboard (demo config; the UI formats it as a %). */
export const UPTIME_PERCENT = 99.9;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const BUCKETS = 5;
const QUEUE_SIZE = 5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUSES: RequestStatus[] = [
  'SUBMITTED',
  'IN_PREPARATION',
  'IN_VERIFICATION',
  'REVISION_REQUIRED',
  'READY_FOR_SIGNING',
  'ISSUED',
];

type Stat = DashboardData['stats'][number];
type QueueItem = DashboardData['queue'][number];

const startOfUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const dueInDays = (due: Date, now: Date) => Math.round((startOfUtcDay(due) - startOfUtcDay(now)) / DAY_MS);
const stat = (key: string, label: string, value: number, tone: Stat['tone']): Stat => ({ key, label, value, tone });
const dayLabel = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

const requestQueueInclude = { client: { select: { name: true } } } satisfies Prisma.IssuanceRequestInclude;
const documentQueueInclude = {
  request: { include: { client: { select: { name: true } } } },
} satisfies Prisma.DocumentInclude;

export const DEFAULT_PERIOD_DAYS = 30;

export async function getDashboard(
  actor: Actor,
  now: Date,
  opts: { periodDays?: number } = {},
): Promise<DashboardData> {
  switch (actor.role) {
    case 'ISSUANCE_OFFICER':
      return officerDashboard(actor, now);
    case 'DOCUMENT_VERIFIER':
      return verifierDashboard(actor, now);
    case 'AUTHORISED_SIGNATORY':
      return signatoryDashboard(actor, now);
    case 'ISSUANCE_MANAGER':
      return managerDashboard(actor, now, opts.periodDays ?? DEFAULT_PERIOD_DAYS);
    case 'SYSTEM_ADMIN':
      return adminDashboard(actor);
  }
}

function requestItem(
  r: Prisma.IssuanceRequestGetPayload<{ include: typeof requestQueueInclude }>,
  now: Date,
): QueueItem {
  return {
    id: r.id,
    number: r.number,
    client: r.client.name,
    scope: r.scopeCode,
    status: r.status,
    dueInDays: dueInDays(r.dueDate, now),
    link: `/requests?select=${r.id}`,
  };
}

function documentItem(
  d: Prisma.DocumentGetPayload<{ include: typeof documentQueueInclude }>,
  now: Date,
  base: string,
): QueueItem {
  return {
    id: d.id,
    number: d.number,
    client: d.request.client.name,
    scope: d.request.scopeCode,
    status: d.status,
    dueInDays: dueInDays(d.request.dueDate, now),
    link: `${base}?select=${d.id}`,
  };
}

async function officerDashboard(actor: Actor, now: Date): Promise<DashboardData> {
  const taskWhere: Prisma.IssuanceRequestWhereInput = {
    assigneeId: actor.userId,
    status: { in: ['SUBMITTED', 'IN_PREPARATION', 'REVISION_REQUIRED'] },
  };
  const mine = (status: string): Prisma.DocumentWhereInput => ({ preparedById: actor.userId, status });
  const [tasks, draft, revision, ready, queue] = await Promise.all([
    prisma.issuanceRequest.count({ where: taskWhere }),
    prisma.document.count({ where: mine('IN_PROGRESS') }),
    prisma.document.count({ where: mine('REVISION') }),
    prisma.document.count({ where: mine('UNDER_VERIFICATION') }),
    prisma.issuanceRequest.findMany({
      where: taskWhere,
      include: requestQueueInclude,
      orderBy: [{ dueDate: 'asc' }, { number: 'asc' }],
      take: QUEUE_SIZE,
    }),
  ]);
  return {
    role: actor.role,
    stats: [
      stat('myTasks', 'My Tasks', tasks, 'blue'),
      stat('draft', 'Draft', draft, 'amber'),
      stat('inRevision', 'In Revision', revision, 'red'),
      stat('readyForVerification', 'Ready for Verification', ready, 'green'),
    ],
    queue: queue.map((r) => requestItem(r, now)),
  };
}

async function verifierDashboard(actor: Actor, now: Date): Promise<DashboardData> {
  const awaitingWhere: Prisma.DocumentWhereInput = {
    status: 'UNDER_VERIFICATION',
    request: { scopeCode: { in: actionableScopes(actor, ['document.verify']) } },
  };
  const [awaiting, verified, returned, queue] = await Promise.all([
    prisma.document.count({ where: awaitingWhere }),
    prisma.verificationResult.count({ where: { verifierId: actor.userId, outcome: 'APPROVED' } }),
    prisma.verificationResult.count({ where: { verifierId: actor.userId, outcome: 'RETURNED' } }),
    prisma.document.findMany({
      where: awaitingWhere,
      include: documentQueueInclude,
      orderBy: [{ request: { dueDate: 'asc' } }, { number: 'asc' }],
      take: QUEUE_SIZE,
    }),
  ]);
  return {
    role: actor.role,
    stats: [
      stat('awaiting', 'Awaiting Verification', awaiting, 'amber'),
      stat('verified', 'Verified', verified, 'green'),
      stat('returned', 'Returned', returned, 'red'),
    ],
    queue: queue.map((d) => documentItem(d, now, '/verification')),
  };
}

async function signatoryDashboard(actor: Actor, now: Date): Promise<DashboardData> {
  const readyWhere: Prisma.DocumentWhereInput = {
    status: 'READY_FOR_SIGNING',
    request: { scopeCode: { in: actionableScopes(actor, ['document.sign']) } },
  };
  const [ready, signed, rejected, queue] = await Promise.all([
    prisma.document.count({ where: readyWhere }),
    prisma.signature.count({ where: { signerId: actor.userId } }),
    prisma.auditLog.count({ where: { actorId: actor.userId, action: 'document.reject' } }),
    prisma.document.findMany({
      where: readyWhere,
      include: documentQueueInclude,
      orderBy: [{ request: { dueDate: 'asc' } }, { number: 'asc' }],
      take: QUEUE_SIZE,
    }),
  ]);
  return {
    role: actor.role,
    stats: [
      stat('readyToSign', 'Ready to Sign', ready, 'blue'),
      stat('signed', 'Signed', signed, 'green'),
      stat('rejected', 'Rejected', rejected, 'red'),
    ],
    queue: queue.map((d) => documentItem(d, now, '/signing')),
  };
}

async function managerDashboard(actor: Actor, now: Date, periodDays: number): Promise<DashboardData> {
  const nowMs = now.getTime();
  const firstStart = new Date(nowMs - BUCKETS * WEEK_MS);
  const period = { gt: firstStart, lte: now };
  // KPI cards, donut and queue cover requests created in the selected window (R15); the trend keeps its 5 weeks.
  const periodStart = new Date(nowMs - periodDays * DAY_MS);
  const [fetched, certificates, issuedInPeriod, queue] = await Promise.all([
    prisma.issuanceRequest.findMany({
      where: { createdAt: { gt: periodStart < firstStart ? periodStart : firstStart } },
      select: { status: true, dueDate: true, createdAt: true },
    }),
    prisma.certificate.findMany({ where: { issueDate: period }, select: { issueDate: true } }),
    prisma.issuanceRequest.findMany({ where: { issuedAt: period }, select: { dueDate: true, issuedAt: true } }),
    prisma.issuanceRequest.findMany({
      where: { status: { not: 'ISSUED' }, createdAt: { gt: periodStart } },
      include: requestQueueInclude,
      orderBy: [{ dueDate: 'asc' }, { number: 'asc' }],
      take: QUEUE_SIZE,
    }),
  ]);

  const requests = fetched.filter((r) => r.createdAt > periodStart);
  const counts = new Map<string, number>();
  for (const r of requests) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const n = (...s: RequestStatus[]) => s.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0);
  const dueSoon = requests.filter((r) => r.status !== 'ISSUED' && isDueSoon(r.dueDate, now)).length;

  const trend = Array.from({ length: BUCKETS }, (_, i) => {
    const start = nowMs - (BUCKETS - i) * WEEK_MS;
    const end = start + WEEK_MS;
    const within = (t: Date) => t.getTime() > start && t.getTime() <= end;
    return {
      label: dayLabel(new Date(start)),
      issued: certificates.filter((c) => within(c.issueDate)).length,
      requested: fetched.filter((r) => within(r.createdAt)).length,
    };
  });

  const onTime = issuedInPeriod.filter((r) => r.issuedAt && isSlaAchieved(r.dueDate, r.issuedAt)).length;
  const achievedPct = issuedInPeriod.length === 0 ? 100 : Math.round((onTime / issuedInPeriod.length) * 100);

  return {
    role: actor.role,
    stats: [
      stat('total', 'Total Requests', requests.length, 'blue'),
      stat('inProgress', 'In Progress', n('IN_PREPARATION', 'IN_VERIFICATION', 'READY_FOR_SIGNING'), 'amber'),
      stat('issued', 'Issued', n('ISSUED'), 'green'),
      stat('needsAction', 'Needs Action', n('REVISION_REQUIRED'), 'red'),
      stat('dueSoon', 'Due ≤7 days', dueSoon, 'purple'),
    ],
    queue: queue.map((r) => requestItem(r, now)),
    trend,
    statusBreakdown: STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 })),
    sla: { achievedPct, targetPct: 90 },
  };
}

const NEGATIVE_ACTION = /reject|return|revoke|suspend/;

async function adminDashboard(actor: Actor): Promise<DashboardData> {
  assertCan(actor, 'user.manage');
  const [users, activeRoles, scopes, audit] = await Promise.all([
    prisma.user.count(),
    prisma.roleAssignment.count({ where: { status: { in: ['ACTIVE', 'RESTRICTED'] } } }),
    prisma.serviceScope.findMany({ select: { documentType: true } }),
    prisma.auditLog.findMany({ orderBy: [{ at: 'desc' }, { id: 'desc' }], take: 8 }),
  ]);
  const actorIds = [...new Set(audit.map((a) => a.actorId).filter((x): x is string => !!x))];
  const people = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(people.map((p) => [p.id, p.name]));
  return {
    role: actor.role,
    stats: [
      stat('users', 'Total Users', users, 'blue'),
      stat('activeRoles', 'Active Roles', activeRoles, 'green'),
      // One template per service scope, of that scope's document type.
      stat('templates', 'Document Templates', scopes.length, 'purple'),
      stat('uptime', 'Uptime', UPTIME_PERCENT, 'green'),
    ],
    queue: [],
    recentActivity: audit.map((a) => ({
      at: a.at.toISOString(),
      text: `${a.actorId ? (names.get(a.actorId) ?? 'Unknown user') : 'System'} · ${a.action} · ${a.entityLabel}`,
      ok: !NEGATIVE_ACTION.test(a.action),
    })),
  };
}
