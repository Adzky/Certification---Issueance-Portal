'use client';

import { BookCheck, CheckCircle2, ClipboardCheck, FileSignature, PenLine, RotateCcw, Search, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useCan, useDocuments, useReference, useSession } from '@/api-client/hooks';
import type { DocumentListQuery, DocumentQueue, DocumentSummary } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useListParams } from '@/components/common/useListParams';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { SigningPanel } from './SigningPanel';
import { TYPE_LABEL } from './shared';
import { VerificationPanel } from './VerificationPanel';

export type ReviewMode = 'verification' | 'signing';

interface ViewDef {
  queue: DocumentQueue;
  title: string;
  subtitle: string;
  noun: string;
  empty: string;
}

const VERIFICATION_VIEWS: Record<string, ViewDef> = {
  queue: {
    queue: 'verification',
    title: 'Verification Queue',
    subtitle: 'Drafts waiting for your review. Check the document, tick the checklist, then approve or return for revision.',
    noun: 'documents',
    empty: 'Nothing is waiting for verification.',
  },
  history: {
    queue: 'verifiedByMe',
    title: 'Verification History',
    subtitle: 'Documents you have verified or returned.',
    noun: 'documents',
    empty: 'You have not verified any documents yet.',
  },
  returned: {
    queue: 'returned',
    title: 'Returned Documents',
    subtitle: 'Drafts returned for revision, waiting for the officer to fix and resend.',
    noun: 'documents',
    empty: 'No documents are waiting for revision.',
  },
};
const SIGNING_VIEWS: Record<string, ViewDef> = {
  queue: {
    queue: 'signing',
    title: 'Signing Queue',
    subtitle: 'Verified documents waiting for your signature.',
    noun: 'documents',
    empty: 'Nothing is waiting to be signed.',
  },
  signed: {
    queue: 'signedByMe',
    title: 'Signed Documents',
    subtitle: 'Documents you have signed.',
    noun: 'documents',
    empty: 'You have not signed any documents yet.',
  },
};

const TYPE_OPTIONS = [
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'INSPECTION_REPORT', label: 'Inspection Report' },
];
const LIST_CONFIG = { filterKeys: ['type', 'scope'] as const, defaultSort: { key: 'updatedAt', dir: 'asc' as const } };
const PURPLE_BUTTON = 'gap-1.5 bg-tone-purple text-white hover:bg-tone-purple/90';

/** Verification (`/verification`) and signing (`/signing`) work queues: stats, table and the action panel on the right. */
export function ReviewListView({ mode }: { mode: ReviewMode }) {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize, hrefFor, select } = list;
  const can = useCan();
  const { data: session } = useSession();
  const { data: reference } = useReference();

  const views = mode === 'verification' ? VERIFICATION_VIEWS : SIGNING_VIEWS;
  const view = views[params.view] ?? views.queue;
  const isQueue = view === views.queue;

  const query: DocumentListQuery = {
    queue: view.queue,
    q: params.q,
    type: params.type as DocumentListQuery['type'],
    scopeCode: params.scope,
    page,
    pageSize,
    sort: sort.key,
    dir: sort.dir,
  };
  const { data, isPending, isError, refetch } = useDocuments(query);
  const stats = data?.stats ?? {};
  const n = (...keys: string[]) => (data ? keys.reduce((sum, k) => sum + (stats[k] ?? 0), 0) : '–');

  const scopeOptions = (reference?.scopes ?? [])
    .filter((s) => can('records.viewAll') || session?.scopeCodes.includes(s.code))
    .map((s) => ({ value: s.code, label: s.name }));
  const filters: FilterDef[] = [
    { key: 'type', label: 'Document Type', allLabel: 'All Types', options: TYPE_OPTIONS },
    { key: 'scope', label: 'Service Scope', allLabel: 'All Services', options: scopeOptions },
  ];

  const columns = useMemo<DataTableColumn<DocumentSummary>[]>(() => {
    const cols: DataTableColumn<DocumentSummary>[] = [
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
      { id: 'preparedBy', header: 'Prepared By', className: 'whitespace-nowrap', cell: (d) => d.preparedByName },
      { id: 'version', header: 'Version', sortKey: 'version', cell: (d) => d.version },
      {
        id: 'updated',
        header: mode === 'verification' ? 'Submitted' : 'Verified',
        sortKey: 'updatedAt',
        className: 'whitespace-nowrap',
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
    ];
    if (isQueue) {
      cols.push({
        id: 'action',
        header: 'Action',
        cell: (d) =>
          mode === 'signing' ? (
            <Button size="sm" className={PURPLE_BUTTON} onClick={(e) => { e.stopPropagation(); select(d.id); }}>
              <PenLine /> Sign
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); select(d.id); }}>
              <ClipboardCheck /> Review
            </Button>
          ),
      });
    }
    return cols;
  }, [hrefFor, mode, isQueue, select]);

  return (
    <div className="space-y-4">
      <PageHeader icon={mode === 'verification' ? ClipboardCheck : FileSignature} title={view.title} subtitle={view.subtitle} />

      {mode === 'verification' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={Search} tone="amber" value={n('UNDER_VERIFICATION')} label="Awaiting Verification" />
          <StatCard icon={CheckCircle2} tone="green" value={n('READY_FOR_SIGNING', 'SIGNED')} label="Verified" />
          <StatCard icon={RotateCcw} tone="purple" value={n('REVISION')} label="Returned (Revision)" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={FileSignature} tone="purple" value={n('READY_FOR_SIGNING')} label="Ready to Sign" />
          <StatCard icon={BookCheck} tone="green" value={n('SIGNED')} label="Signed" />
          <StatCard icon={XCircle} tone="red" value={n('REJECTED')} label="Rejected" />
        </div>
      )}

      <FilterBar
        searchPlaceholder="Search by Draft No., Request No. or Client…"
        filters={filters}
        value={list.filters}
        onChange={list.onFiltersChange}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0">
          {isError ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm">
              <p className="text-destructive">Could not load documents.</p>
              <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              ariaLabel={view.title}
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
              noun={view.noun}
              loading={isPending}
              empty={view.empty}
            />
          )}
        </div>
        <div className="xl:sticky xl:top-4">
          {mode === 'verification' ? <VerificationPanel documentId={list.selectedId} /> : <SigningPanel documentId={list.selectedId} />}
        </div>
      </div>
    </div>
  );
}
