'use client';

import { CheckCircle2, ClipboardCheck, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan, useReference, useWorkflowAction } from '@/api-client/hooks';
import type { DocumentDetail } from '@/contract/types';
import { DetailPanel } from '@/components/common/DetailPanel';
import { toastError } from '@/components/common/notify';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReasonDialog } from './ReasonDialog';
import { DocumentData, DocumentOverview, PanelLoader, ReviewHistory } from './shared';

/** Right-hand verifier panel: document + preview, the checklist with Approve / Return for Revision. */
export function VerificationPanel({ documentId }: { documentId: string | null }) {
  return (
    <PanelLoader documentId={documentId} emptyTitle="Select a document to verify">
      {(doc) => <VerificationBody key={doc.id} doc={doc} />}
    </PanelLoader>
  );
}

function VerificationBody({ doc }: { doc: DocumentDetail }) {
  const can = useCan();
  const { data: reference } = useReference();
  const workflow = useWorkflowAction();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const [returning, setReturning] = useState(false);

  const checklist = reference?.checklist ?? [];
  const actionable = doc.status === 'UNDER_VERIFICATION' && can('document.verify');
  const allChecked = checklist.length > 0 && checklist.every((c) => checked[c.key]);
  const checklistBody = Object.fromEntries(checklist.map((c) => [c.key, !!checked[c.key]]));

  const approve = async () => {
    try {
      await workflow.mutateAsync({ kind: 'verify', id: doc.id, body: { checklist: checklistBody, comment: comment.trim() || undefined } });
      toast.success('Document verified', { description: 'It is now ready for signing.' });
    } catch (e) {
      toastError(e);
    }
  };

  const giveBack = async (reason: string) => {
    try {
      await workflow.mutateAsync({ kind: 'return', id: doc.id, body: { checklist: checklistBody, comment: reason } });
      setReturning(false);
      toast.success('Returned for revision', { description: 'The officer can see your comment.' });
    } catch (e) {
      setReturning(false);
      toastError(e);
    }
  };

  const checklistTab = (
    <div className="space-y-4">
      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-bold">Verification Checklist</legend>
        {checklist.map((c) => (
          <div key={c.key} className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
            <Checkbox
              id={`chk-${c.key}`}
              className="mt-0.5"
              checked={!!checked[c.key]}
              onCheckedChange={(v) => setChecked((s) => ({ ...s, [c.key]: v === true }))}
            />
            <Label htmlFor={`chk-${c.key}`} className="flex-1 text-sm leading-snug font-normal">
              {c.label}
            </Label>
          </div>
        ))}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="verifier-comment" className="text-sm font-bold">
          Comment <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="verifier-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notes for the signatory…" />
      </div>
    </div>
  );

  const actions = actionable ? (
    <>
      <Button onClick={approve} disabled={!allChecked || workflow.isPending} className="gap-2">
        <CheckCircle2 /> Approve
      </Button>
      <Button variant="outline" onClick={() => setReturning(true)} disabled={workflow.isPending} className="gap-2 text-primary">
        <RotateCcw /> Return for Revision
      </Button>
      {!allChecked && <p className="basis-full text-xs text-muted-foreground">Tick every checklist item to enable Approve.</p>}
    </>
  ) : (
    <p className="text-sm text-muted-foreground">
      {doc.status === 'UNDER_VERIFICATION' ? 'You cannot verify this document.' : 'This document is no longer awaiting verification.'}
    </p>
  );

  return (
    <>
      <DetailPanel
        title="Verification Detail"
        icon={ClipboardCheck}
        badge={doc.number}
        tabs={[
          { key: 'overview', label: 'Overview', content: <DocumentOverview doc={doc} /> },
          ...(actionable ? [{ key: 'checklist', label: 'Checklist', content: checklistTab }] : []),
          { key: 'data', label: 'Document Data', content: <DocumentData doc={doc} /> },
          { key: 'history', label: 'History', content: <ReviewHistory doc={doc} /> },
        ]}
        actions={actions}
      />
      <ReasonDialog
        open={returning}
        onOpenChange={setReturning}
        initialText={comment}
        title="Return for Revision"
        description="Tell the officer what needs to be corrected. The draft goes back to Revision."
        confirmLabel="Return for Revision"
        pending={workflow.isPending}
        onConfirm={giveBack}
      />
    </>
  );
}
