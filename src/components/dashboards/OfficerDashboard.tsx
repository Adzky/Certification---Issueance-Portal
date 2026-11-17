'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { DashboardData } from '@/contract/types';
import { Panel, QueueTable, StatRow, clientColumn, noColumn, numberColumn, serviceColumn, slaColumn, statusColumn } from './shared';

export function OfficerDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <StatRow stats={data.stats} />
      <Panel title="Document Preparation Tasks">
        <QueueTable
          label="Document preparation tasks"
          items={data.queue}
          empty="No tasks assigned to you right now."
          viewAllHref="/requests"
          viewAllLabel="View all requests"
          columns={[
            noColumn,
            numberColumn('Request No.'),
            clientColumn,
            serviceColumn,
            statusColumn('request'),
            slaColumn('Due'),
            {
              id: 'action',
              header: 'Action',
              cell: (i) => (
                <Link href={i.link} aria-label={`Open ${i.number}`} className="inline-flex text-primary hover:text-primary/70">
                  <ExternalLink className="size-4" aria-hidden />
                </Link>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
