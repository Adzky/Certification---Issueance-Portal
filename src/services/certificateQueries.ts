import type { Prisma } from '@prisma/client';
import { prisma } from '@/repositories/prisma';
import { DomainError } from '@/domain/errors';
import type { Actor, CertificateDisplayStatus, Page } from '@/domain/types';
import { assertReadable, dateRange, paging, readableScopes, sortDir, type ListQuery } from './context';
import {
  certificateInclude,
  toCertificateDetail,
  toCertificateSummary,
  toPublicCertificate,
  type CertificateDetail,
  type CertificateSummary,
  type PublicCertificate,
} from './dto';

const DISPLAY_STATUSES: readonly CertificateDisplayStatus[] = [
  'ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'SUSPENDED',
  'REVOKED',
  'IN_RENEWAL',
];

export type CertificateStats = Record<CertificateDisplayStatus | 'TOTAL', number>;

type Sortable = Pick<CertificateSummary, 'number' | 'issueDate' | 'validUntil' | 'clientName' | 'displayStatus'>;
const SORT_KEYS: (keyof Sortable)[] = ['number', 'issueDate', 'validUntil', 'clientName', 'displayStatus'];

export async function listCertificates(
  actor: Actor,
  q: ListQuery & { scheme?: string } = {},
): Promise<Page<CertificateSummary> & { stats: CertificateStats }> {
  const now = new Date();
  const scopes = readableScopes(actor);
  const and: Prisma.CertificateWhereInput[] = [];
  if (scopes) and.push({ request: { scopeCode: { in: scopes } } });
  if (q.q?.trim()) {
    const term = q.q.trim();
    and.push({ OR: [{ number: { contains: term } }, { request: { client: { name: { contains: term } } } }] });
  }
  if (q.scopeCode) and.push({ request: { scopeCode: q.scopeCode } });
  if (q.scheme) and.push({ request: { scope: { schemeCode: q.scheme } } });
  if (q.type) and.push({ type: q.type });
  const issued = dateRange(q);
  if (issued) and.push({ issueDate: issued });

  // Display status depends on "now", so filter/stats/paging run in memory (demo-scale data).
  const rows = await prisma.certificate.findMany({ where: { AND: and }, include: certificateInclude });
  const all = rows.map((r) => toCertificateSummary(r, now));

  const stats = { TOTAL: all.length } as CertificateStats;
  for (const s of DISPLAY_STATUSES) stats[s] = 0;
  for (const c of all) stats[c.displayStatus] += 1;

  const filtered = q.status ? all.filter((c) => c.displayStatus === q.status) : all;
  const key = (SORT_KEYS as string[]).includes(q.sort ?? '') ? (q.sort as keyof Sortable) : 'issueDate';
  const sign = sortDir(q) === 'asc' ? 1 : -1;
  filtered.sort((a, b) => sign * String(a[key]).localeCompare(String(b[key])) || b.number.localeCompare(a.number));

  const { page, pageSize, skip } = paging(q);
  return { items: filtered.slice(skip, skip + pageSize), total: filtered.length, page, pageSize, stats };
}

export async function getCertificate(actor: Actor, id: string): Promise<CertificateDetail> {
  const c = await prisma.certificate.findUnique({ where: { id }, include: certificateInclude });
  if (!c) throw new DomainError('NOT_FOUND', 'Certificate not found');
  assertReadable(actor, c.request.scopeCode, 'Certificate');
  return toCertificateDetail(c);
}

export async function getPublicCertificate(certNo: string): Promise<PublicCertificate | null> {
  const c = await prisma.certificate.findUnique({ where: { number: String(certNo ?? '').trim() }, include: certificateInclude });
  return c ? toPublicCertificate(c) : null;
}
