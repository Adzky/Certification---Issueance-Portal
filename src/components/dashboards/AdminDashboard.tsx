'use client';

import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import type { DashboardData } from '@/contract/types';
import { EmptyState } from '@/components/common/EmptyState';
import { humaniseActivity } from '@/lib/auditLabels';
import { formatDateTime } from '@/lib/format';
import { Panel, StatRow } from './shared';

export function AdminDashboard({ data }: { data: DashboardData }) {
  const activity = data.recentActivity ?? [];
  return (
    <div className="space-y-4">
      <StatRow stats={data.stats} />
      <Panel title="Recent System Activity">
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions taken in the portal appear here." />
        ) : (
          <ul aria-label="Recent system activity" className="divide-y">
            {activity.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex items-center gap-4 py-2.5 text-sm">
                <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="w-36 shrink-0 text-muted-foreground">{formatDateTime(a.at)}</span>
                <span className="min-w-0 flex-1 truncate">{humaniseActivity(a.text)}</span>
                {a.ok ? (
                  <CheckCircle2 className="size-5 shrink-0 text-tone-green" aria-label="Completed" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-tone-red" aria-label="Negative outcome" />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
