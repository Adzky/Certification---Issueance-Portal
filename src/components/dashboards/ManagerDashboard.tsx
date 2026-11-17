'use client';

import { CalendarDays } from 'lucide-react';
import { useDashboard } from '@/api-client/hooks';
import { cn } from '@/lib/utils';
import { Panel, QueueTable, StatRow, clientColumn, noColumn, numberColumn, serviceColumn, slaColumn, statusColumn, DashboardSkeleton } from './shared';
import { SlaGauge } from './SlaGauge';
import { StatusDonut } from './StatusDonut';
import { TrendChart } from './TrendChart';

export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

/** Segmented "Last 7 / 30 / 90 days" selector. */
export function PeriodSelector({ value, onChange }: { value: PeriodDays; onChange: (d: PeriodDays) => void }) {
  return (
    <div role="radiogroup" aria-label="Period" className="inline-flex items-center gap-1 rounded-lg border bg-card p-1 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <CalendarDays className="mx-1.5 size-4 text-primary" aria-hidden />
      {PERIODS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          aria-label={`Last ${d} days`}
          onClick={() => onChange(d)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            value === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

export function ManagerDashboard({ periodDays }: { periodDays: PeriodDays }) {
  const { data } = useDashboard(periodDays);
  if (!data) return <DashboardSkeleton />;
  return (
    <div className="space-y-4">
      <StatRow stats={data.stats} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Certificate Issuance Trend">
          <TrendChart data={data.trend ?? []} />
        </Panel>
        <Panel title="Request Status" center>
          <StatusDonut data={data.statusBreakdown ?? []} />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Priority Issuance Queue">
          <QueueTable
            label="Priority issuance queue"
            items={data.queue}
            empty="No open requests in this period."
            viewAllHref="/requests"
            viewAllLabel="View all requests"
            columns={[noColumn, numberColumn('Request No.'), clientColumn, serviceColumn, statusColumn('request'), slaColumn('SLA')]}
          />
        </Panel>
        <Panel title="SLA Achievement" center>
          {data.sla && <SlaGauge sla={data.sla} />}
        </Panel>
      </div>
    </div>
  );
}
