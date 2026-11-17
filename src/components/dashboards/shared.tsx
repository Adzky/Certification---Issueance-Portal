'use client';

import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FilePen,
  FileText,
  Hourglass,
  LayoutTemplate,
  PenLine,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useReference } from '@/api-client/hooks';
import type { DashboardData } from '@/contract/types';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import type { StatusKind } from '@/lib/status';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DashboardStat = DashboardData['stats'][number];
export type QueueItem = DashboardData['queue'][number];

const STAT_ICONS: Record<string, LucideIcon> = {
  myTasks: ClipboardList,
  draft: FilePen,
  inRevision: AlertTriangle,
  readyForVerification: FileCheck2,
  awaiting: Hourglass,
  verified: CheckCircle2,
  returned: AlertTriangle,
  readyToSign: PenLine,
  signed: CheckCircle2,
  rejected: AlertTriangle,
  total: FileText,
  inProgress: Hourglass,
  issued: CheckCircle2,
  needsAction: AlertTriangle,
  dueSoon: CalendarClock,
  users: Users,
  activeRoles: ShieldCheck,
  templates: LayoutTemplate,
  uptime: Activity,
};

const statValue = (s: DashboardStat) => (s.key === 'uptime' ? `${formatNumber(s.value)}%` : formatNumber(s.value));

/** The KPI row: one card per stat, in equal columns. */
export function StatRow({ stats }: { stats: DashboardStat[] }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${stats.length > 4 ? 11 : 13}rem, 1fr))` }}
    >
      {stats.map((s) => (
        <StatCard
          key={s.key}
          icon={STAT_ICONS[s.key] ?? FileText}
          tone={s.tone}
          label={s.label}
          value={<span data-testid={`stat-${s.key}`}>{statValue(s)}</span>}
        />
      ))}
    </div>
  );
}

/** White rounded panel with a heading, used by every dashboard section. */
export function Panel({
  title,
  actions,
  children,
  className,
  center,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Vertically centres the body in the space left under the heading (for charts beside a taller panel). */
  center?: boolean;
}) {
  return (
    <section className={cn('flex flex-col rounded-xl border bg-card p-5 shadow-[0_1px_3px_rgb(15_23_42/0.05)]', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {actions}
      </div>
      {center ? <div className="flex flex-1 items-center justify-center">{children}</div> : children}
    </section>
  );
}

/** "⏱ 3 days", "⏱ Today", or "⏱ 2 days overdue" (red). */
export function SlaCell({ days }: { days?: number }) {
  if (days === undefined) return <span className="text-muted-foreground">–</span>;
  if (days < 0) {
    const n = -days;
    return (
      <span className="font-medium whitespace-nowrap text-tone-red">
        ⏱ {n} {n === 1 ? 'day' : 'days'} overdue
      </span>
    );
  }
  return (
    <span className={cn('font-medium whitespace-nowrap', days <= 2 ? 'text-tone-red' : 'text-foreground')}>
      ⏱ {days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`}
    </span>
  );
}

export interface QueueColumn {
  id: string;
  header: string;
  cell: (item: QueueItem, index: number, scopeName: (code: string) => string) => ReactNode;
  className?: string;
}

/** Compact task table used on the dashboards (no paging: the API returns only the top few items). */
export function QueueTable({
  label,
  items,
  columns,
  empty,
  viewAllHref,
  viewAllLabel,
}: {
  label: string;
  items: QueueItem[];
  columns: QueueColumn[];
  empty: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  const { data: ref } = useReference();
  const scopeName = (code: string) => ref?.scopes.find((s) => s.code === code)?.name ?? code;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={label}>
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-foreground">
              {columns.map((c) => (
                <th key={c.id} scope="col" className={cn('h-10 px-2 whitespace-nowrap', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  {columns.map((c) => (
                    <td key={c.id} className={cn('px-2 py-3 align-middle', c.className)}>
                      {c.cell(item, i, scopeName)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {viewAllHref && (
        <div className="mt-2 text-right">
          <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
            {viewAllLabel ?? 'View all'} →
          </Link>
        </div>
      )}
    </div>
  );
}

export const noColumn: QueueColumn = { id: 'no', header: 'No.', cell: (_i, idx) => idx + 1, className: 'w-12' };
export const numberColumn = (header: string): QueueColumn => ({
  id: 'number',
  header,
  cell: (i) => (
    <Link href={i.link} className="font-medium whitespace-nowrap text-primary hover:underline">
      {i.number}
    </Link>
  ),
});
export const clientColumn: QueueColumn = { id: 'client', header: 'Client', cell: (i) => i.client };
export const serviceColumn: QueueColumn = { id: 'service', header: 'Service', cell: (i, _x, name) => name(i.scope) };
export const statusColumn = (kind: StatusKind): QueueColumn => ({
  id: 'status',
  header: 'Status',
  cell: (i) => <StatusPill status={i.status} kind={kind} />,
});
export const slaColumn = (header: string): QueueColumn => ({
  id: 'sla',
  header,
  cell: (i) => <SlaCell days={i.dueInDays} />,
});

/** Placeholder shown until the dashboard data has loaded. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[4.75rem] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
