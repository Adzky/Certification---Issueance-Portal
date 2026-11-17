'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { DashboardData } from '@/contract/types';
import { formatNumber } from '@/lib/format';
import { statusLabel, statusTone } from '@/lib/status';

type Breakdown = NonNullable<DashboardData['statusBreakdown']>;

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

/** Fill per request status: the status tone token; "Submitted" is a lighter amber so it differs from "In Preparation". */
const fillFor = (status: string) =>
  status === 'SUBMITTED' ? 'color-mix(in srgb, var(--tone-amber) 45%, white)' : `var(--tone-${statusTone(status, 'request')})`;

/** Request-status donut: total in the centre, legend with count and share. */
export function StatusDonut({ data }: { data: Breakdown }) {
  const total = data.reduce((n, s) => n + s.count, 0);
  const slices = total === 0 ? [{ status: 'NONE', count: 1 }] : data.filter((s) => s.count > 0);
  return (
    <div className="flex items-center gap-6">
      <div
        className="relative size-44 shrink-0"
        role="img"
        aria-label={`Requests by status, ${formatNumber(total)} in total`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="status"
              innerRadius="68%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={slices.length > 1 ? 1 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.status} fill={s.status === 'NONE' ? 'var(--tone-grey-soft)' : fillFor(s.status)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl leading-none font-bold text-foreground" data-testid="donut-total">
            {formatNumber(total)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">Requests</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5 text-sm" aria-label="Status breakdown">
        {data.map((s) => (
          <li key={s.status} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: fillFor(s.status) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-foreground">{statusLabel(s.status)}</span>
            <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
              {formatNumber(s.count)} <span className="text-muted-foreground">({pct(s.count, total)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
