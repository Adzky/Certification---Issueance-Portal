'use client';

import { Check, Minus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/api-client/hooks';
import type { Action } from '@/domain/types';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';

const ACTION_LABEL: Record<Action, { label: string; description: string }> = {
  'request.create': { label: 'Create issuance request', description: 'Open a new request for a client and service scope.' },
  'document.prepare': { label: 'Prepare draft', description: 'Create the draft document for a request.' },
  'document.edit': { label: 'Edit draft', description: 'Change the fields of a draft.' },
  'document.submit': { label: 'Submit for verification', description: 'Hand a finished draft to the verifier.' },
  'document.verify': { label: 'Verify document', description: 'Approve a document for signing.' },
  'document.return': { label: 'Return for revision', description: 'Send a document back with a reason.' },
  'document.sign': { label: 'Sign document', description: 'Sign and issue the certificate or report.' },
  'document.reject': { label: 'Reject document', description: 'Reject a document that is not fit to issue.' },
  'certificate.suspend': { label: 'Suspend certificate', description: 'Temporarily suspend an issued certificate.' },
  'certificate.reinstate': { label: 'Reinstate certificate', description: 'Lift a suspension.' },
  'certificate.revoke': { label: 'Revoke certificate', description: 'Withdraw an issued certificate.' },
  'registration.decide': { label: 'Decide authorisation requests', description: 'Approve or reject new personnel registrations.' },
  'user.manage': { label: 'Manage users and roles', description: 'Change assignment status and service scopes.' },
  'records.viewAll': { label: 'View all records', description: 'See every request, document and certificate regardless of scope.' },
};

/** Read-only role x action matrix (GET /api/permissions). */
export function PermissionMatrix() {
  const { data, isError, refetch } = usePermissions();
  return (
    <div className="space-y-4">
      <PageHeader
        icon={ShieldCheck}
        title="Permission Matrix"
        subtitle="Which role may perform which action. The matrix is fixed in this release and shown here for reference."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">Back to Settings</Link>
          </Button>
        }
      />
      {isError ? (
        <EmptyState title="Could not load the permission matrix" action={<Button onClick={() => void refetch()}>Try again</Button>} />
      ) : !data ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label="Loading" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]">
          <table className="w-full text-sm" aria-label="Permission matrix">
            <thead className="bg-[#f7f9fd]">
              <tr className="border-b">
                <th scope="col" className="h-12 px-4 text-left font-semibold">
                  Action
                </th>
                {data.roles.map((r) => (
                  <th key={r.role} scope="col" className="h-12 px-3 text-center text-xs font-semibold">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.actions.map((action) => {
                const info = ACTION_LABEL[action];
                return (
                  <tr key={action} className="border-b last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="block font-semibold">{info?.label ?? action}</span>
                      <span className="block text-xs text-muted-foreground">{info?.description ?? action}</span>
                    </th>
                    {data.roles.map((r) => {
                      const allowed = r.actions.includes(action);
                      return (
                        <td key={r.role} className="px-3 py-3 text-center">
                          {allowed ? (
                            <Check className="mx-auto size-5 text-tone-green" strokeWidth={2.5} aria-label={`${r.label} can ${info?.label ?? action}`} />
                          ) : (
                            <Minus className="mx-auto size-4 text-slate-300" aria-label={`${r.label} cannot ${info?.label ?? action}`} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
