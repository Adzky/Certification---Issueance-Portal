'use client';

import { CheckCircle2, FilePen, FileText, Pencil, Search, Trash2, PenLine } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useCan, useDocuments, useReference, useSession } from '@/api-client/hooks';
import type { DocumentSummary, ListQuery } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useListParams } from '@/components/common/useListParams';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { statusLabel } from '@/lib/status';
import { DraftDetailPanel } from './DraftDetailPanel';

const DOCUMENT_STATUSES = ['IN_PROGRESS', 'UNDER_VERIFICATION', 'REVISION', 'READY_FOR_SIGNING', 'SIGNED', 'REJECTED'];
const STATUS_OPTIONS = DOCUMENT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));
const TYPE_OPTIONS = [
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'INSPECTION_REPORT', label: 'Inspection Report' },
];
const TYPE_LABEL: Record<string, string> = { CERTIFICATE: 'Certificate', INSPECTION_REPORT: 'Inspection Report' };
const FILTER_KEYS = ['type', 'scope', 'status', 'from', 'to'] as const;
const LIST_CONFIG = { filterKeys: FILTER_KEYS, defaultSort: { key: 'updatedAt', dir: 'desc' as const } };

/** Draft Documents list page: stats, filters, table and the draft detail panel (state lives in the URL). */
export function DraftsView() {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize, hrefFor, select } = list;
  const can = useCan();
  const { data: session } = useSession();
  const { data: reference } = useReference();

  const query: ListQuery = {
    q: params.q,
    type: params.type as ListQuery['type'],
    scopeCode: params.scope,
    status: params.status,
    from: params.from,
    to: params.to,
    page,
    pageSize,
    sort: sort.key,
    dir: sort.dir,
  };
  const { data, isPending, isError, refetch } = useDocuments(query);
  const stats = data?.stats ?? {};

  const scopeOptions = (reference?.scopes ?? [])
    .filter((s) => can('records.viewAll') || session?.scopeCodes.includes(s.code))
    .map((s) => ({ value: s.code, label: s.name }));
  const filters: FilterDef[] = [
    { key: 'type', label: 'Document Type', allLabel: 'All Types', options: TYPE_OPTIONS },
    { key: 'scope', label: 'Service Scope', allLabel: 'All Services', options: scopeOptions },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: STATUS_OPTIONS },
  ];

  const columns = useMemo<DataTableColumn<DocumentSummary>[]>(
    () => [
      {
        id: 'number',
        header: 'Draft No.',
        sortKey: 'number',
        cell: (d) => (
          <Link
            href={hrefFor(d.id)}
            scroll={false}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold whitespace-nowrap text-primary underline underline-offset-2"
          >
            {d.number}
          </Link>
        ),
      },
      { id: 'request', header: 'Request No.', sortKey: 'requestNumber', className: 'whitespace-nowrap', cell: (d) => d.requestNumber },
      { id: 'client', header: 'Client', sortKey: 'clientName', cell: (d) => <span className="font-medium">{d.clientName}</span> },
      {
        id: 'type',
        header: 'Document Type',
        sortKey: 'type',
        cell: (d) => (
          <span title={d.scopeName} className="whitespace-nowrap">
            {TYPE_LABEL[d.type]}
          </span>
        ),
      },
      { id: 'version', header: 'Version', sortKey: 'version', cell: (d) => d.version },
      { id: 'updated', header: 'Last Updated', sortKey: 'updatedAt', className: 'whitespace-nowrap',
        cell: (d) => {
          const [day, time] = formatDateTime(d.updatedAt).split(', ');
          return (
            <span className="leading-tight">
              {day}
              <span className="block text-xs text-muted-foreground">{time}</span>
            </span>
          );
        },
      },
      { id: 'status', header: 'Status', sortKey: 'status', cell: (d) => <StatusPill status={d.status} kind="document" /> },
    ],
    [hrefFor],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FilePen}
        title="Draft Documents"
        subtitle="Manage all document drafts (certificate, inspection report) before verification and signing."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={FileText} tone="blue" value={stats.TOTAL ?? '–'} label="Total Drafts" />
        <StatCard icon={Pencil} tone="amber" value={stats.IN_PROGRESS ?? '–'} label="In Progress" />
        <StatCard icon={Search} tone="blue" value={stats.UNDER_VERIFICATION ?? '–'} label="Under Verification" />
        <StatCard icon={CheckCircle2} tone="green" value={stats.READY_FOR_SIGNING ?? '–'} label="Ready for Signing" />
        <StatCard icon={PenLine} tone="purple" value={stats.REVISION ?? '–'} label="Revision" />
        <StatCard icon={Trash2} tone="red" value={stats.REJECTED ?? '–'} label="Rejected" />
      </div>

      <FilterBar
        searchPlaceholder="Search by Draft No., Request No., Client, or Object…"
        filters={filters}
        value={list.filters}
        onChange={list.onFiltersChange}
        dateRange
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0">
          {isError ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm">
              <p className="text-destructive">Could not load drafts.</p>
              <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              ariaLabel="Draft documents"
              columns={columns}
              data={data?.items ?? []}
              total={data?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={list.onPageChange}
              onPageSizeChange={list.onPageSizeChange}
              sort={sort}
              onSort={list.onSort}
              selectedId={list.selectedId}
              onSelect={(d) => select(d.id)}
              noun="drafts"
              loading={isPending}
              empty="No drafts match your filters."
            />
          )}
        </div>
        <div className="xl:sticky xl:top-4">
          <DraftDetailPanel documentId={list.selectedId} />
        </div>
      </div>
    </div>
  );
}
