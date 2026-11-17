'use client';

import type { DashboardData } from '@/contract/types';

const R = 52;
const C = 2 * Math.PI * R;

/** Ring gauge for SLA achievement; green at or above target, amber below. */
export function SlaGauge({ sla }: { sla: NonNullable<DashboardData['sla']> }) {
  const pct = Math.max(0, Math.min(100, sla.achievedPct));
  const ok = pct >= sla.targetPct;
  const colour = ok ? 'var(--tone-green)' : 'var(--tone-amber)';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-40" role="img" aria-label={`${pct}% SLA achieved, target at least ${sla.targetPct}%`}>
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--tone-grey-soft)" strokeWidth="14" />
          <circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke={colour}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl leading-none font-bold text-foreground" data-testid="sla-pct">
            {pct}%
          </span>
          <span className="mt-1 text-xs text-muted-foreground">SLA achieved</span>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">Target ≥ {sla.targetPct}%</p>
    </div>
  );
}
