'use client';

import type { DashboardData } from '@/contract/types';
import { Panel, QueueTable, StatRow, clientColumn, noColumn, numberColumn, serviceColumn, slaColumn, statusColumn } from './shared';

export function VerifierDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <StatRow stats={data.stats} />
      <Panel title="Verification Queue">
        <QueueTable
          label="Verification queue"
          items={data.queue}
          empty="Nothing is waiting for verification."
          viewAllHref="/verification"
          viewAllLabel="Open verification queue"
          columns={[
            noColumn,
            numberColumn('Document No.'),
            clientColumn,
            serviceColumn,
            statusColumn('document'),
            slaColumn('Due'),
          ]}
        />
      </Panel>
    </div>
  );
}
