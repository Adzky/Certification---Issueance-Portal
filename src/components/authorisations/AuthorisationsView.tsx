'use client';

import { CheckCircle2, Eye, Hourglass, UserCheck, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useRegistrations } from '@/api-client/hooks';
import type { RegistrationSummary } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useListParams } from '@/components/common/useListParams';
import { Button } from '@/components/ui/button';
import { REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { ROLE_LABEL, ROLES } from '@/domain/permissions';
import { formatDate } from '@/lib/format';
import { AuthorisationDetailPanel } from './AuthorisationDetailPanel';

const LIST_CONFIG = { filterKeys: ['status', 'role'] as const, defaultSort: { key: 'createdAt', dir: 'desc' as const } };
// "All Statuses" is replaced by the default view (Pending); the explicit "All" option shows everything.
const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Status',
    allLabel: 'Pending',
    options: [
      { value: 'APPROVED', label: 'Approved' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'ALL', label: 'All' },
    ],
  },
  { key: 'role', label: 'Role', allLabel: 'All Roles', options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
];

const SORTERS: Record<string, (a: RegistrationSummary, b: RegistrationSummary) => number> = {
  name: (a, b) => a.applicantName.localeCompare(b.applicantName),
  role: (a, b) => ROLE_LABEL[a.role].localeCompare(ROLE_LABEL[b.role]),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  status: (a, b) => a.status.localeCompare(b.status),
};

/** Manager's "Pending Authorisations": applications table plus the review panel (state in the URL). */
export function AuthorisationsView() {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize, select } = list;
  const { data, isPending, isError, refetch } = useRegistrations();

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const r of data ?? []) c[r.status]++;
    return c;
  }, [data]);

  const statusFilter = params.status ?? 'PENDING';
  const q = (params.q ?? '').trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = (data ?? []).filter(
      (r) =>
        (statusFilter === 'ALL' || r.status === statusFilter) &&
        (!params.role || r.role === params.role) &&
        (!q || `${r.applicantName} ${r.email} ${ROLE_LABEL[r.role]} ${r.requestedScopes.join(' ')}`.toLowerCase().includes(q)),
    );
    const cmp = SORTERS[sort.key] ?? SORTERS.createdAt!;
    return filtered.sort((a, b) => (sort.dir === 'asc' ? cmp(a, b) : cmp(b, a)));
  }, [data, statusFilter, params.role, q, sort.key, sort.dir]);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const columns = useMemo<DataTableColumn<RegistrationSummary>[]>(
    () => [
      {
        id: 'name',
        header: 'Applicant',
        sortKey: 'name',
        cell: (r) => (
          <span className="block">
            <span className="block font-semibold">{r.applicantName}</span>
            <span className="block text-xs text-muted-foreground">{r.email}</span>
          </span>
        ),
      },
      { id: 'role', header: 'Role', sortKey: 'role', cell: (r) => ROLE_LABEL[r.role] },
      {
        id: 'scopes',
        header: 'Service Scope',
        cell: (r) => (
          <span className="flex flex-wrap gap-1">
            {r.requestedScopes.map((s) => (
              <span key={s} className="rounded-full bg-tone-blue-soft px-2 py-0.5 text-xs font-medium text-tone-blue">
                {s}
              </span>
            ))}
          </span>
        ),
      },
      { id: 'submitted', header: 'Submitted', sortKey: 'createdAt', className: 'whitespace-nowrap', cell: (r) => formatDate(r.createdAt) },
      // The API only accepts a registration with all required documents.
      { id: 'docs', header: 'Documents', className: 'whitespace-nowrap', cell: () => `${REQUIRED_CONTROL_DOCUMENTS.length} / ${REQUIRED_CONTROL_DOCUMENTS.length}` },
      { id: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusPill status={r.status} kind="registration" /> },
      {
        id: 'actions',
        header: 'Actions',
        cell: (r) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Review ${r.applicantName}`}
            className="text-primary"
            onClick={(e) => {
              e.stopPropagation();
              select(r.id);
            }}
          >
            <Eye />
          </Button>
        ),
      },
    ],
    [select],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={UserCheck}
        title="Pending Authorisations"
        subtitle="Review registration requests from new personnel, check their control documents, then approve or reject."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Hourglass} tone="amber" value={data ? counts.PENDING : '–'} label="Awaiting Decision" />
        <StatCard icon={CheckCircle2} tone="green" value={data ? counts.APPROVED : '–'} label="Approved" />
        <StatCard icon={XCircle} tone="red" value={data ? counts.REJECTED : '–'} label="Rejected" />
      </div>
      <FilterBar searchPlaceholder="Search by name, email, role or scope…" filters={FILTERS} value={list.filters} onChange={list.onFiltersChange} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0">
          {isError ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm">
              <p className="text-destructive">Could not load registrations.</p>
              <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              ariaLabel="Authorisation requests"
              columns={columns}
              data={pageRows}
              total={rows.length}
              page={page}
              pageSize={pageSize}
              onPageChange={list.onPageChange}
              onPageSizeChange={list.onPageSizeChange}
              sort={sort}
              onSort={list.onSort}
              selectedId={list.selectedId}
              onSelect={(r) => select(r.id)}
              noun="applications"
              loading={isPending}
              empty={statusFilter === 'PENDING' ? 'No registrations are waiting for a decision.' : 'No applications match your filters.'}
            />
          )}
        </div>
        <div className="xl:sticky xl:top-20">
          <AuthorisationDetailPanel id={list.selectedId} />
        </div>
      </div>
    </div>
  );
}
