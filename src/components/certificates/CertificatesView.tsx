'use client';

import { Award, BadgeCheck, CalendarX2, Download, Eye, Hourglass, PauseCircle, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useCan, useCertificates, useReference, useSession } from '@/api-client/hooks';
import { api } from '@/api-client/client';
import type { CertificateListQuery, CertificateSummary } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useListParams } from '@/components/common/useListParams';
import { Button } from '@/components/ui/button';
import { formatDateUtc } from '@/lib/format';
import { CertificateDetailPanel } from './CertificateDetailPanel';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRING', label: 'Expiring' },
  { value: 'IN_RENEWAL', label: 'In Renewal' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'EXPIRED', label: 'Expired' },
];
const LIST_CONFIG = { filterKeys: ['scope', 'scheme', 'status'] as const, defaultSort: { key: 'issueDate', dir: 'desc' as const } };

/** Issued Certificates (`/certificates`): stats, filters, register table and the certificate detail panel. */
export function CertificatesView() {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize, hrefFor, select } = list;
  const can = useCan();
  const { data: session } = useSession();
  const { data: reference } = useReference();

  const query: CertificateListQuery = {
    q: params.q,
    scopeCode: params.scope,
    scheme: params.scheme,
    status: params.status,
    from: params.from,
    to: params.to,
    page,
    pageSize,
    sort: sort.key,
    dir: sort.dir,
  };
  const { data, isPending, isError, refetch } = useCertificates(query);
  const stats = data?.stats;
  const n = (k: keyof NonNullable<typeof stats>) => (stats ? stats[k] : '–');

  const visibleScopes = (reference?.scopes ?? []).filter((s) => can('records.viewAll') || session?.scopeCodes.includes(s.code));
  const schemes = [...new Map(visibleScopes.map((s) => [s.schemeCode, s.schemeLabel])).entries()].map(([value, label]) => ({ value, label }));
  const filters: FilterDef[] = [
    { key: 'scope', label: 'Service Scope', allLabel: 'All Services', options: visibleScopes.map((s) => ({ value: s.code, label: s.name })) },
    { key: 'scheme', label: 'Certification Scheme', allLabel: 'All Schemes', options: schemes },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: STATUS_OPTIONS },
  ];

  const columns = useMemo<DataTableColumn<CertificateSummary>[]>(
    () => [
      {
        id: 'number',
        header: 'Certificate No.',
        sortKey: 'number',
        cell: (c) => (
          <Link
            href={hrefFor(c.id)}
            scroll={false}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold whitespace-nowrap text-primary underline underline-offset-2"
          >
            {c.number}
          </Link>
        ),
      },
      { id: 'client', header: 'Client / Organization', sortKey: 'clientName', cell: (c) => <span className="font-medium">{c.clientName}</span> },
      { id: 'scope', header: 'Service Scope', className: 'min-w-24', cell: (c) => c.scopeName },
      { id: 'scheme', header: 'Scheme / Standard', className: 'min-w-24', cell: (c) => c.schemeLabel },
      { id: 'issued', header: 'Issue Date', sortKey: 'issueDate', className: 'whitespace-nowrap', cell: (c) => formatDateUtc(c.issueDate) },
      { id: 'valid', header: 'Valid Until', sortKey: 'validUntil', className: 'whitespace-nowrap', cell: (c) => formatDateUtc(c.validUntil) },
      { id: 'status', header: 'Status', sortKey: 'displayStatus', cell: (c) => <StatusPill status={c.displayStatus} kind="certificate" /> },
      {
        id: 'actions',
        header: 'Actions',
        className: 'w-px whitespace-nowrap',
        cell: (c) => (
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${c.number}`}
              onClick={(e) => {
                e.stopPropagation();
                select(c.id);
              }}
            >
              <Eye />
            </Button>
            <Button variant="ghost" size="icon-sm" asChild>
              <a
                href={api.certificates.pdfUrl(c.id)}
                download={`${c.number}.pdf`}
                aria-label={`Download ${c.number}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Download />
              </a>
            </Button>
          </span>
        ),
      },
    ],
    [hrefFor, select],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Award}
        title="Issued Certificates"
        subtitle="Manage and monitor all certificates that have been signed and published, including their validity and lifecycle."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
        <StatCard icon={Award} tone="blue" value={n('TOTAL')} label="Total Issued" />
        <StatCard icon={BadgeCheck} tone="green" value={n('ACTIVE')} label="Active" />
        <StatCard icon={Hourglass} tone="amber" value={n('EXPIRING')} label="Expiring (≤ 30 Days)" />
        <StatCard icon={RotateCcw} tone="purple" value={n('IN_RENEWAL')} label="In Renewal" />
        <StatCard icon={PauseCircle} tone="red" value={n('SUSPENDED')} label="Suspended" />
        <StatCard icon={XCircle} tone="grey" value={n('REVOKED')} label="Revoked" />
        <StatCard icon={CalendarX2} tone="red" value={n('EXPIRED')} label="Expired" />
      </div>

      <FilterBar
        searchPlaceholder="Search by Certificate No. or Client…"
        filters={filters}
        value={list.filters}
        onChange={list.onFiltersChange}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0">
          {isError ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm">
              <p className="text-destructive">Could not load certificates.</p>
              <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              ariaLabel="Issued certificates"
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
              onSelect={(c) => select(c.id)}
              noun="certificates"
              loading={isPending}
              empty="No certificates match your filters."
            />
          )}
        </div>
        <div className="xl:sticky xl:top-4">
          <CertificateDetailPanel certificateId={list.selectedId} />
        </div>
      </div>
    </div>
  );
}
