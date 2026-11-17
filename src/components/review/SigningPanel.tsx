'use client';

import { FileSignature, PenLine, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan, useSession, useWorkflowAction } from '@/api-client/hooks';
import type { CertificateDetail, DocumentDetail } from '@/contract/types';
import { DetailList, DetailPanel } from '@/components/common/DetailPanel';
import { toastError } from '@/components/common/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { ReasonDialog } from './ReasonDialog';
import { DocumentData, DocumentOverview, PanelLoader, ReviewHistory } from './shared';

const PURPLE_BUTTON = 'gap-2 bg-tone-purple text-white hover:bg-tone-purple/90';

/** Right-hand signatory panel: preview, verification summary, Sign Document / Reject. */
export function SigningPanel({ documentId }: { documentId: string | null }) {
  return (
    <PanelLoader documentId={documentId} emptyTitle="Select a document to sign">
      {(doc) => <SigningBody key={doc.id} doc={doc} />}
    </PanelLoader>
  );
}

function SigningBody({ doc }: { doc: DocumentDetail }) {
  const can = useCan();
  const { data: session } = useSession();
  const workflow = useWorkflowAction();
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [issued, setIssued] = useState<CertificateDetail | null>(null);

  const actionable = doc.status === 'READY_FOR_SIGNING' && can('document.sign');
  const approval = [...doc.verifications].reverse().find((v) => v.outcome === 'APPROVED');
  const signerName = session?.user.name ?? 'the signatory';

  const sign = async () => {
    try {
      const result = (await workflow.mutateAsync({ kind: 'sign', id: doc.id })) as { certificate: CertificateDetail };
      setConfirming(false);
      setIssued(result.certificate);
    } catch (e) {
      setConfirming(false);
      toastError(e);
    }
  };

  const reject = async (reason: string) => {
    try {
      await workflow.mutateAsync({ kind: 'reject', id: doc.id, body: { reason } });
      setRejecting(false);
      toast.success('Document rejected', { description: 'The request goes back to preparation.' });
    } catch (e) {
      setRejecting(false);
      toastError(e);
    }
  };

  const summary = (
    <div className="rounded-lg border p-3">
      <h3 className="mb-1 text-sm font-bold">Verification Summary</h3>
      {approval ? (
        <DetailList
          items={[
            { label: 'Verified By', value: approval.verifierName },
            { label: 'Verified On', value: formatDateTime(approval.createdAt) },
            { label: 'Comment', value: approval.comment ?? <span className="text-muted-foreground">No comment</span> },
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No approved verification on record.</p>
      )}
    </div>
  );

  const actions = actionable ? (
    <>
      <Button onClick={() => setConfirming(true)} disabled={workflow.isPending} className={PURPLE_BUTTON}>
        <PenLine /> Sign Document
      </Button>
      <Button variant="destructive" onClick={() => setRejecting(true)} disabled={workflow.isPending} className="gap-2">
        <XCircle /> Reject
      </Button>
    </>
  ) : (
    <p className="text-sm text-muted-foreground">
      {doc.status === 'READY_FOR_SIGNING' ? 'You cannot sign this document.' : 'This document is no longer waiting for a signature.'}
    </p>
  );

  return (
    <>
      <DetailPanel
        title="Signing Detail"
        icon={FileSignature}
        badge={doc.number}
        tabs={[
          { key: 'overview', label: 'Overview', content: <DocumentOverview doc={doc}>{summary}</DocumentOverview> },
          { key: 'data', label: 'Document Data', content: <DocumentData doc={doc} /> },
          { key: 'history', label: 'History', content: <ReviewHistory doc={doc} /> },
        ]}
        actions={actions}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Document</DialogTitle>
            <DialogDescription>Sign as {signerName}, Authorised Signatory?</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signature.svg" alt="Signature" className="mx-auto h-16" />
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {doc.number} · {doc.clientName}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={workflow.isPending}>
              Cancel
            </Button>
            <Button onClick={sign} disabled={workflow.isPending} className={PURPLE_BUTTON}>
              Sign Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document signed</DialogTitle>
            <DialogDescription>The certificate has been issued.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-tone-green-soft px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">Certificate number</p>
            <p data-testid="certificate-number" className="text-lg font-bold">
              {issued?.number}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssued(null)}>
              Close
            </Button>
            <Button asChild>
              <Link href={`/certificates?select=${issued?.id ?? ''}`}>View Certificate</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject Document"
        description="Give the reason for rejecting. The request goes back to preparation."
        confirmLabel="Reject Document"
        destructive
        pending={workflow.isPending}
        onConfirm={reject}
      />
    </>
  );
}
