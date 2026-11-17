'use client';

import { History } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useAudit, useCan, useSession } from '@/api-client/hooks';
import type { AuditEntry, AuditListQuery } from '@/contract/types';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterBar, type FilterDef } from '@/components/common/FilterBar';
import { PageHeader } from '@/components/common/PageHeader';
import { useListParams } from '@/components/common/useListParams';
import { Button } from '@/components/ui/button';
import { isPathAllowed } from '@/domain/nav';
import type { Role } from '@/domain/types';
import { formatDateTime } from '@/lib/format';
import { ROLE_META } from '@/lib/roles';
import { statusLabel } from '@/lib/status';

const ENTITY_OPTIONS = [
  { value: 'REQUEST', label: 'Request' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'USER', label: 'User' },
];
const FILTERS: FilterDef[] = [{ key: 'entityType', label: 'Entity Type', allLabel: 'All Entities', options: ENTITY_OPTIONS }];

const ACTION_LABEL: Record<string, string> = {
  'request.create': 'Request created',
  'document.prepare': 'Draft prepared',
  'document.edit': 'Draft edited',
  'document.submit': 'Submitted for verification',
  'document.verify': 'Verified',
  'document.return': 'Returned for revision',
  'document.sign': 'Signed',
  'document.reject': 'Rejected',
  'certificate.issue': 'Certificate issued',
  'certificate.suspend': 'Certificate suspended',
  'certificate.reinstate': 'Certificate reinstated',
  'certificate.revoke': 'Certificate revoked',
  'registration.submit': 'Registration submitted',
  'registration.decide': 'Registration decided',
  'user.updateAssignment': 'Authorisation updated',
};
const actionLabel = (a: string) => ACTION_LABEL[a] ?? statusLabel(a.replace(/\./g, '_'));

/** Where an audit entry's entity can be opened for this role, or null when no page the role may open shows it. */
export function entityHref(role: Role | undefined, e: Pick<AuditEntry, 'entityType' | 'entityId'>): string | null {
  if (!role) return null;
  const id = encodeURIComponent(e.entityId);
  const candidates: string[] = (() => {
    switch (e.entityType) {
      case 'REQUEST':
        return [`/requests?select=${id}`];
      case 'DOCUMENT':
        return [`/drafts?select=${id}`, `/verification?select=${id}`, `/signing?select=${id}`];
      case 'CERTIFICATE':
        return [`/certificates?select=${id}`];
      case 'REGISTRATION':
        return [`/authorisations?select=${id}`];
      case 'USER':
        return ['/users'];
      default:
        return [];
    }
  })();
  return candidates.find((href) => isPathAllowed(role, href.split('?')[0])) ?? null;
}

const LIST_CONFIG = { filterKeys: ['entityType'] as const, defaultSort: { key: 'at', dir: 'desc' as const } };

/** Audit Trail (`/audit`): who did what, when. Manager and Admin see everything, other roles their own entries. */
export function AuditView() {
  const list = useListParams(LIST_CONFIG);
  const { params, sort, page, pageSize } = list;
  const { data: session } = useSession();
  const can = useCan();
  const role = session?.role;

  const query: AuditListQuery = {
    q: params.q,
    entityType: params.entityType,
    entityId: params.entityId,
    from: params.from,
    to: params.to,
    page,
    pageSize,
    sort: sort.key,
    dir: sort.dir,
  };
  const { data, isPending, isError, refetch } = useAudit(query);

  const columns = useMemo<DataTableColumn<AuditEntry>[]>(
    () => [
      { id: 'at', header: 'Time', sortKey: 'at', className: 'whitespace-nowrap', cell: (e) => formatDateTime(e.at) },
      { id: 'user', header: 'User', cell: (e) => e.actorName ?? 'System' },
      {
        id: 'role',
        header: 'Role',
        cell: (e) => (e.actorRole ? ROLE_META[e.actorRole].label : '–'),
      },
      { id: 'action', header: 'Action', sortKey: 'action', cell: (e) => <span className="font-medium">{actionLabel(e.action)}</span> },
      {
        id: 'entity',
        header: 'Entity',
        sortKey: 'entityLabel',
        cell: (e) => {
          const href = entityHref(role, e);
          return href ? (
            <Link href={href} className="font-medium text-primary hover:underline">
              {e.entityLabel}
            </Link>
          ) : (
            e.entityLabel
          );
        },
      },
      { id: 'comment', header: 'Comment', className: 'max-w-80 text-muted-foreground', cell: (e) => e.comment ?? '–' },
    ],
    [role],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={History}
        title="Audit Trail"
        subtitle={
          can('records.viewAll')
            ? 'Every change made in the portal, newest first.'
            : 'Changes you made, and changes to documents you worked on.'
        }
      />
      <FilterBar
        searchPlaceholder="Search action, entity or comment"
        filters={FILTERS}
        value={list.filters}
        onChange={list.onFiltersChange}
        dateRange
      />
      {isError ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm">
          <p className="text-destructive">Could not load the audit trail.</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          ariaLabel="Audit trail"
          columns={columns}
          data={data?.items ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={list.onPageChange}
          onPageSizeChange={list.onPageSizeChange}
          sort={sort}
          onSort={list.onSort}
          noun="entries"
          loading={isPending}
          empty="No audit entries match your filters."
        />
      )}
    </div>
  );
}
