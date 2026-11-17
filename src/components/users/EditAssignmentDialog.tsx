'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useReference, useUpdateAssignment } from '@/api-client/hooks';
import type { AuthorisationStatus } from '@/domain/types';
import { toastError } from '@/components/common/notify';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ROLE_LABEL } from '@/domain/permissions';
import { statusLabel } from '@/lib/status';
import type { AssignmentRow } from './UsersView';

const EDITABLE_STATUSES: AuthorisationStatus[] = ['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'REVOKED'];

/** Edit one assignment: status (Active / Restricted / Suspended / Revoked) and service scopes. */
export function EditAssignmentDialog({ row, onClose }: { row: AssignmentRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{row && <EditForm key={row.id} row={row} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function EditForm({ row, onClose }: { row: AssignmentRow; onClose: () => void }) {
  const { user, assignment } = row;
  const { data: reference } = useReference();
  const update = useUpdateAssignment();
  const [status, setStatus] = useState<AuthorisationStatus>(assignment.status);
  const [scopes, setScopes] = useState<string[]>(assignment.scopeCodes);

  // A pending or expired assignment keeps its current value as an extra option.
  const options = EDITABLE_STATUSES.includes(assignment.status) ? EDITABLE_STATUSES : [assignment.status, ...EDITABLE_STATUSES];
  const scopesChanged = scopes.slice().sort().join() !== assignment.scopeCodes.join();
  const changed = status !== assignment.status || scopesChanged;

  const save = () => {
    update.mutate(
      {
        id: assignment.assignmentId,
        body: { ...(status !== assignment.status ? { status } : {}), ...(scopesChanged ? { scopeCodes: scopes } : {}) },
      },
      {
        onSuccess: () => {
          toast.success('Authorisation updated', { description: `${user.name} – ${ROLE_LABEL[assignment.role]}` });
          onClose();
        },
        onError: toastError,
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit authorisation</DialogTitle>
        <DialogDescription>
          {user.name} · {ROLE_LABEL[assignment.role]}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="assignment-status">Status</Label>
          <select
            id="assignment-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AuthorisationStatus)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Only Active and Restricted assignments can sign in.</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Service scopes</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(reference?.scopes ?? []).map((s) => (
              <li key={s.code} className="flex items-center gap-2">
                <Checkbox
                  id={`scope-${s.code}`}
                  checked={scopes.includes(s.code)}
                  onCheckedChange={(on) => setScopes((cur) => (on === true ? [...cur, s.code] : cur.filter((c) => c !== s.code)))}
                />
                <Label htmlFor={`scope-${s.code}`} className="font-normal">
                  {s.name}
                </Label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!changed || update.isPending}>
          Save Changes
        </Button>
      </DialogFooter>
    </>
  );
}
