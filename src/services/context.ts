import { z } from 'zod';
import { DomainError } from '@/domain/errors';
import { can } from '@/domain/permissions';
import type { Action, Actor } from '@/domain/types';
import type { ListQuery } from '@/contract/types';

export type { ListQuery } from '@/contract/types';

const DAY_MS = 86_400_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Parses `input` with `schema`; any failure becomes DomainError('VALIDATION'). */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    throw new DomainError('VALIDATION', `${path}${issue?.message ?? 'Invalid input'}`);
  }
  return r.data;
}

export const canViewAll = (actor: Actor): boolean => can(actor, 'records.viewAll');

/** Scope codes the actor may read, or `null` when unrestricted. */
export function readableScopes(actor: Actor): string[] | null {
  return canViewAll(actor) ? null : actor.scopeCodes;
}

/** Throws NOT_FOUND (not FORBIDDEN) so out-of-scope records are not disclosed. */
export function assertReadable(actor: Actor, scopeCode: string, what: string): void {
  const scopes = readableScopes(actor);
  if (scopes && !scopes.includes(scopeCode)) throw new DomainError('NOT_FOUND', `${what} not found`);
}

/** Scope codes in which the actor can perform `action` (intersected with an optional filter). */
export function actionableScopes(actor: Actor, actions: Action[]): string[] {
  return actor.scopeCodes.filter((s) => actions.some((a) => can(actor, a, s)));
}

export function paging(q: ListQuery): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(q.pageSize) || DEFAULT_PAGE_SIZE)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parseDay(value: string, name: string): number {
  const t = Date.parse(value);
  if (Number.isNaN(t)) throw new DomainError('VALIDATION', `${name}: invalid date`);
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `from`/`to` (inclusive whole UTC days) as a Prisma DateTime filter. */
export function dateRange(q: ListQuery): { gte?: Date; lt?: Date } | undefined {
  if (!q.from && !q.to) return undefined;
  const r: { gte?: Date; lt?: Date } = {};
  if (q.from) r.gte = new Date(parseDay(q.from, 'from'));
  if (q.to) r.lt = new Date(parseDay(q.to, 'to') + DAY_MS);
  return r;
}

export const sortDir = (q: ListQuery): 'asc' | 'desc' => (q.dir === 'asc' ? 'asc' : 'desc');

/** Turns `groupBy` rows into `{ TOTAL, <status>: n }`. */
export function statusStats(
  rows: { status: string; _count: { _all: number } }[],
  statuses: readonly string[],
): Record<string, number> {
  const stats: Record<string, number> = { TOTAL: 0 };
  for (const s of statuses) stats[s] = 0;
  for (const r of rows) {
    stats[r.status] = (stats[r.status] ?? 0) + r._count._all;
    stats.TOTAL += r._count._all;
  }
  return stats;
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 3, NORMAL: 2, LOW: 1 };

/** Sort rank of a priority (HIGH > NORMAL > LOW); unknown values sort lowest. */
export const priorityRank = (priority: string): number => PRIORITY_RANK[priority] ?? 0;

/**
 * Orders `{ id, priority, tiebreak }` rows by priority rank (`desc` = HIGH first), ties broken by
 * `tiebreak` descending, and returns the ids of the requested page. Priority is a text column, so
 * a database ORDER BY would sort it alphabetically; at demo scale an in-memory sort is simplest.
 */
export function pageIdsByPriority(
  rows: { id: string; priority: string; tiebreak: string }[],
  dir: 'asc' | 'desc',
  skip: number,
  take: number,
): string[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows]
    .sort((a, b) => sign * (priorityRank(a.priority) - priorityRank(b.priority)) || b.tiebreak.localeCompare(a.tiebreak))
    .slice(skip, skip + take)
    .map((r) => r.id);
}
