'use client';

import { Ban, PauseCircle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan, useWorkflowAction } from '@/api-client/hooks';
import type { CertificateDetail } from '@/contract/types';
import { toastError } from '@/components/common/notify';
import { ReasonDialog } from '@/components/review/ReasonDialog';
import { Button } from '@/components/ui/button';

type Pending = 'suspend' | 'revoke' | null;

/** Suspend / Reinstate / Revoke for users holding `certificate.suspend`; each valid action for the current status is shown. */
export function LifecycleActions({ certificate }: { certificate: CertificateDetail }) {
  const can = useCan();
  const workflow = useWorkflowAction();
  const [dialog, setDialog] = useState<Pending>(null);

  if (!can('certificate.suspend')) return null;
  const { status } = certificate;
  const canSuspend = status === 'ACTIVE' && can('certificate.suspend');
  const canReinstate = status === 'SUSPENDED' && can('certificate.reinstate');
  const canRevoke = (status === 'ACTIVE' || status === 'SUSPENDED') && can('certificate.revoke');
  if (!canSuspend && !canReinstate && !canRevoke) return null;

  const run = async (kind: 'suspend' | 'revoke', reason: string) => {
    try {
      await workflow.mutateAsync({ kind, id: certificate.id, body: { reason } });
      setDialog(null);
      toast.success(kind === 'suspend' ? 'Certificate suspended' : 'Certificate revoked');
    } catch (e) {
      setDialog(null);
      toastError(e);
    }
  };

  const reinstate = async () => {
    try {
      await workflow.mutateAsync({ kind: 'reinstate', id: certificate.id });
      toast.success('Certificate reinstated');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3" aria-label="Lifecycle actions" role="group">
      <span className="mr-auto text-sm font-semibold">Lifecycle actions</span>
      {canSuspend && (
        <Button variant="outline" size="sm" className="gap-1.5" disabled={workflow.isPending} onClick={() => setDialog('suspend')}>
          <PauseCircle /> Suspend
        </Button>
      )}
      {canReinstate && (
        <Button variant="outline" size="sm" className="gap-1.5" disabled={workflow.isPending} onClick={reinstate}>
          <PlayCircle /> Reinstate
        </Button>
      )}
      {canRevoke && (
        <Button variant="destructive" size="sm" className="gap-1.5" disabled={workflow.isPending} onClick={() => setDialog('revoke')}>
          <Ban /> Revoke
        </Button>
      )}
      <ReasonDialog
        open={dialog === 'suspend'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Suspend Certificate"
        description={`Suspend ${certificate.number}. It will show as suspended on the public verification page.`}
        confirmLabel="Suspend Certificate"
        pending={workflow.isPending}
        onConfirm={(r) => run('suspend', r)}
      />
      <ReasonDialog
        open={dialog === 'revoke'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Revoke Certificate"
        description={`Revoke ${certificate.number}. This cannot be undone.`}
        confirmLabel="Revoke Certificate"
        destructive
        pending={workflow.isPending}
        onConfirm={(r) => run('revoke', r)}
      />
    </div>
  );
}
