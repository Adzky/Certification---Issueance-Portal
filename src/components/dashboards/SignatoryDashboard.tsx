'use client';

import { PenLine } from 'lucide-react';
import Link from 'next/link';
import type { DashboardData } from '@/contract/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Panel, QueueTable, StatRow, clientColumn, noColumn, numberColumn, serviceColumn, slaColumn } from './shared';

export function SignatoryDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <StatRow stats={data.stats} />
      <Panel title="Documents Ready to Sign">
        <QueueTable
          label="Documents ready to sign"
          items={data.queue}
          empty="No documents are waiting for your signature."
          viewAllHref="/signing"
          viewAllLabel="Open signing queue"
          columns={[
            noColumn,
            numberColumn('Document No.'),
            clientColumn,
            serviceColumn,
            slaColumn('Due'),
            {
              id: 'action',
              header: 'Action',
              cell: (i) => (
                <Link
                  href={`/signing?select=${i.id}`}
                  className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-tone-purple text-white hover:bg-tone-purple/90')}
                >
                  <PenLine aria-hidden /> Sign
                </Link>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
