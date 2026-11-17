'use client';

import { CircleCheck, CirclePause, Pencil, ShieldAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSession, useUsers } from '@/api-client/hooks';
import type { UserAssignment, UserSummary } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useListParams } from '@/components/common/useListParams';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ROLE_LABEL, ROLES } from '@/domain/permissions';
import { formatDate, initials } from '@/lib/format';
import { statusLabel } from '@/lib/status';
import { EditAssignmentDialog } from './EditAssignmentDialog';

/** One table row: a user's single role assignment. */
export interface AssignmentRow {
  /** Assignment id (unique per row). */
  id: string;
  user: UserSummary;
  assignment: UserAssignment;
}

const STATUSES = ['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'REVOKED', 'PENDING', 'EXPIRED'];
const FILTERS: FilterDef[] = [
  { key: 'role', label: 'Role', allLabel: 'All Roles', options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
  { key: 'status', label: 'Status', allLabel: 'All Statuses', options: STATUSES.map((s) => ({ value: s, label: statusLabel(s) })) },
];
const LIST_CONFIG = { filterKeys: ['role', 'status'] as const, defaultSort: { key: 'name', dir: 'asc' as const } };

const SORTERS: Record<string, (a: AssignmentRow, b: AssignmentRow) => number> = {
  name: (a, b) => a.user.name.localeCompare(b.user.name) || a.assignment.role.localeCompare(b.assignment.role),
  role: (a, b) => ROLE_LABEL[a.assignment.role].localeCompare(ROLE_LABEL[b.assignment.role]) || a.user.name.localeCompare(b.user.name),
  status: (a, b) => a.assignment.status.localeCompare(b.assignment.status) || a.user.name.localeCompare(b.user.name),
  until: (a, b) => (a.assignment.authorisedUntil ?? '').localeCompare(b.assignment.authorisedUntil ?? ''),
};

const period = (a: UserAssignment) =>
  a.authorisedFrom && a.authorisedUntil ? `${formatDate(a.authorisedFrom)} – ${formatDate(a.authorisedUntil)}` : a.authorisedUntil ? `Until ${formatDate(a.authorisedUntil)}` : '–';

/** Admin "User & Role Management": every user × role assignment, with an edit dialog. */
export function UsersView() {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize } = list;
  const { data: users, isPending, isError, refetch } = useUsers();
  const { data: session } = useSession();
  const [editing, setEditing] = useState<AssignmentRow | null>(null);

  const all = useMemo<AssignmentRow[]>(
    () => (users ?? []).flatMap((u) => u.assignments.map((a) => ({ id: a.assignmentId, user: u, assignment: a }))),
    [users],
  );
  const q = (params.q ?? '').trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = all.filter(
      (r) =>
        (!params.role || r.assignment.role === params.role) &&
        (!params.status || r.assignment.status === params.status) &&
        (!q || `${r.user.name} ${r.user.email} ${r.user.unit ?? ''} ${r.assignment.scopeCodes.join(' ')}`.toLowerCase().includes(q)),
    );
    const cmp = SORTERS[sort.key] ?? SORTERS.name!;
    return filtered.sort((a, b) => (sort.dir === 'asc' ? cmp(a, b) : cmp(b, a)));
  }, [all, params.role, params.status, q, sort.key, sort.dir]);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const count = (...s: string[]) => all.filter((r) => s.includes(r.assignment.status)).length;
  const isSelf = (r: AssignmentRow) => r.user.id === session?.user.id && r.assignment.role === session?.role;

  const columns = useMemo<DataTableColumn<AssignmentRow>[]>(
    () => [
      {
        id: 'name',
        header: 'User',
        sortKey: 'name',
        cell: (r) => (
          <span className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-navy text-xs font-semibold text-white">{initials(r.user.name)}</AvatarFallback>
            </Avatar>
            <span className="block min-w-0">
              <span className="block font-semibold">{r.user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.user.email}</span>
            </span>
          </span>
        ),
      },
      { id: 'role', header: 'Role', sortKey: 'role', cell: (r) => ROLE_LABEL[r.assignment.role] },
      {
        id: 'scopes',
        header: 'Service Scope',
        cell: (r) => (
          <span className="flex flex-wrap gap-1">
            {r.assignment.scopeCodes.length === 0 ? (
              <span className="text-muted-foreground">–</span>
            ) : (
              r.assignment.scopeCodes.map((s) => (
                <span key={s} className="rounded-full bg-tone-blue-soft px-2 py-0.5 text-xs font-medium text-tone-blue">
                  {s}
                </span>
              ))
            )}
          </span>
        ),
      },
      { id: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusPill status={r.assignment.status} kind="authorisation" /> },
      { id: 'period', header: 'Authorisation Period', sortKey: 'until', className: 'whitespace-nowrap', cell: (r) => period(r.assignment) },
      {
        id: 'actions',
        header: 'Actions',
        cell: (r) => (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-primary"
            aria-label={`Edit ${r.user.name} – ${ROLE_LABEL[r.assignment.role]}`}
            title={isSelf(r) ? 'You cannot change your own authorisation' : undefined}
            disabled={isSelf(r)}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(r);
            }}
          >
            <Pencil />
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isSelf reads the session identity only
    [session?.user.id, session?.role],
  );

  return (
    <div className="space-y-4">
      <PageHeader icon={Users} title="User & Role Management" subtitle="Manage users, their roles, service scopes and authorisation status." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} tone="blue" value={users ? users.length : '–'} label="Users" />
        <StatCard icon={CircleCheck} tone="green" value={users ? count('ACTIVE') : '–'} label="Active Authorisations" />
        <StatCard icon={ShieldAlert} tone="amber" value={users ? count('RESTRICTED', 'PENDING') : '–'} label="Restricted / Pending" />
        <StatCard icon={CirclePause} tone="red" value={users ? count('SUSPENDED', 'REVOKED', 'EXPIRED') : '–'} label="Suspended / Revoked" />
      </div>
      <FilterBar searchPlaceholder="Search by name, email, unit or scope…" filters={FILTERS} value={list.filters} onChange={list.onFiltersChange} />
      {isError ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm">
          <p className="text-destructive">Could not load users.</p>
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          ariaLabel="Users and role assignments"
          columns={columns}
          data={pageRows}
          total={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={list.onPageChange}
          onPageSizeChange={list.onPageSizeChange}
          sort={sort}
          onSort={list.onSort}
          noun="assignments"
          loading={isPending}
          empty="No users match your filters."
        />
      )}
      <EditAssignmentDialog row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
