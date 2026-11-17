'use client';

import { AlertTriangle, Award, CheckCircle2, ClipboardList, Eye, FileSearch, FileText, Hourglass, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useCan, useReference, useRequests, useSession } from '@/api-client/hooks';
import type { ListQuery, RequestSummary } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { ScopeIcon } from '@/components/common/ScopeIcon';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useListParams } from '@/components/common/useListParams';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/format';
import { statusLabel } from '@/lib/status';
import { CreateRequestDialog } from './CreateRequestDialog';
import { RequestDetailPanel } from './RequestDetailPanel';

const REQUEST_STATUSES = ['SUBMITTED', 'IN_PREPARATION', 'IN_VERIFICATION', 'REVISION_REQUIRED', 'READY_FOR_SIGNING', 'ISSUED'];
const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];
const STATUS_OPTIONS = REQUEST_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));
const FILTER_KEYS = ['status', 'scope', 'priority', 'from', 'to'] as const;
const LIST_CONFIG = { filterKeys: FILTER_KEYS, defaultSort: { key: 'createdAt', dir: 'desc' as const }, descFirst: ['priority'] };

/** Issuance Requests list page: stats, filters, table and the request detail panel (state lives in the URL). */
export function RequestsView() {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize } = list;
  const can = useCan();
  const { data: session } = useSession();
  const { data: reference } = useReference();

  const query: ListQuery = {
    q: params.q,
    status: params.status,
    scopeCode: params.scope,
    priority: params.priority as ListQuery['priority'],
    from: params.from,
    to: params.to,
    page,
    pageSize,
    sort: sort.key,
    dir: sort.dir,
  };
  const { data, isPending, isError, refetch } = useRequests(query);
  const stats = data?.stats ?? {};

  const scopeOptions = (reference?.scopes ?? [])
    .filter((s) => can('records.viewAll') || session?.scopeCodes.includes(s.code))
    .map((s) => ({ value: s.code, label: s.name }));
  const filters: FilterDef[] = [
    { key: 'scope', label: 'Service Scope', allLabel: 'All Services', options: scopeOptions },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: STATUS_OPTIONS },
    { key: 'priority', label: 'Priority', allLabel: 'All Priorities', options: PRIORITY_OPTIONS },
  ];

  const { hrefFor, select } = list;
  const categoryOf = useMemo(() => new Map((reference?.scopes ?? []).map((s) => [s.code, s.category])), [reference]);
  const columns = useMemo<DataTableColumn<RequestSummary>[]>(
    () => [
      {
        id: 'number',
        header: 'Request No.',
        sortKey: 'number',
        cell: (r) => (
          <Link
            href={hrefFor(r.id)}
            scroll={false}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold whitespace-nowrap text-primary underline underline-offset-2"
          >
            {r.number}
          </Link>
        ),
      },
      { id: 'client', header: 'Client / Organization', sortKey: 'clientName', cell: (r) => <span className="font-medium">{r.clientName}</span> },
      {
        id: 'scope',
        header: 'Service Scope',
        sortKey: 'scopeName',
        cell: (r) => (
          <span className="flex items-center gap-2">
            <ScopeIcon documentType={r.documentType} category={categoryOf.get(r.scopeCode)} />
            <span>{r.scopeName}</span>
          </span>
        ),
      },
      { id: 'date', header: 'Request Date', sortKey: 'createdAt', className: 'whitespace-nowrap', cell: (r) => formatDate(r.createdAt) },
      { id: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusPill status={r.status} kind="request" /> },
      { id: 'priority', header: 'Priority', sortKey: 'priority', cell: (r) => <StatusPill status={r.priority} kind="priority" /> },
      {
        id: 'actions',
        header: 'Actions',
        cell: (r) => (
          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`View ${r.number}`} onClick={() => select(r.id)} className="text-primary">
              <Eye />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${r.number}`} className="text-primary">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => select(r.id)}>View details</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard?.writeText(r.number);
                    toast.success('Request number copied');
                  }}
                >
                  Copy request number
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ),
      },
    ],
    [hrefFor, select, categoryOf],
  );

  const pending = (stats.SUBMITTED ?? 0) + (stats.IN_PREPARATION ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardList}
        title="Issuance Requests"
        subtitle="Manage requests for certificate/report issuance, monitor progress, and take the next action according to your role."
        actions={
          can('request.create') && (
            <CreateRequestDialog
              onCreated={(r) =>
                list.navigate({ select: r.id, q: undefined, status: undefined, scope: undefined, priority: undefined, from: undefined, to: undefined, sort: undefined, dir: undefined })
              }
            />
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={FileText} tone="blue" value={stats.TOTAL ?? '–'} label="Total Requests" />
        <StatCard icon={Hourglass} tone="amber" value={data ? pending : '–'} label="Pending Preparation" />
        <StatCard icon={FileSearch} tone="blue" value={stats.IN_VERIFICATION ?? '–'} label="In Verification" />
        <StatCard icon={CheckCircle2} tone="green" value={stats.READY_FOR_SIGNING ?? '–'} label="Ready for Signing" />
        <StatCard icon={Award} tone="purple" value={stats.ISSUED ?? '–'} label="Issued" />
        <StatCard icon={AlertTriangle} tone="red" value={stats.REVISION_REQUIRED ?? '–'} label="Returned / Revision" />
      </div>

      <FilterBar
        searchPlaceholder="Search by Request No., Client, or Service…"
        filters={filters}
        value={list.filters}
        onChange={list.onFiltersChange}
        dateRange
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0">
          {isError ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm">
              <p className="text-destructive">Could not load requests.</p>
              <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              ariaLabel="Issuance requests"
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
              onSelect={(r) => select(r.id)}
              noun="requests"
              loading={isPending}
              empty="No requests match your filters."
            />
          )}
        </div>
        <div className="xl:sticky xl:top-4">
          <RequestDetailPanel requestId={list.selectedId} />
        </div>
      </div>
    </div>
  );
}
