'use client';

import { ArrowLeft, MessageSquareWarning, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan, useDocument, useUpdateDocument, useWorkflowAction } from '@/api-client/hooks';
import type { DocumentDetail } from '@/contract/types';
import { EmptyState } from '@/components/common/EmptyState';
import { toastError } from '@/components/common/notify';
import { StatusPill } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { missingRequiredFields, TEMPLATE_FIELDS } from '@/domain/templates';
import { DocumentPreview } from './DocumentPreview';
import { DraftEditorForm } from './DraftEditorForm';

export const EDITABLE_STATUSES = ['IN_PROGRESS', 'REVISION'] as const;

/** Edit page body: form on the left, live preview on the right, Save / Save & Send to Verification. */
export function DraftEditorView({ id }: { id: string }) {
  const { data: doc, isPending, error } = useDocument(id);
  if (isPending) return <p className="py-10 text-center text-sm text-muted-foreground">Loading draft…</p>;
  if (error || !doc) {
    return (
      <EmptyState
        title="Draft not found"
        description="It may have been removed or is outside your service scopes."
        action={
          <Button asChild variant="outline">
            <Link href="/drafts">Back to Draft Documents</Link>
          </Button>
        }
      />
    );
  }
  return <Editor key={doc.id} doc={doc} />;
}

function Editor({ doc }: { doc: DocumentDetail }) {
  const router = useRouter();
  const can = useCan();
  const update = useUpdateDocument();
  const workflow = useWorkflowAction();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(TEMPLATE_FIELDS[doc.type].map((f) => [f.key, ''])),
    ...doc.fields,
  }));
  const [invalid, setInvalid] = useState<string[]>([]);

  const editable = (EDITABLE_STATUSES as readonly string[]).includes(doc.status) && can('document.edit');
  const busy = update.isPending || workflow.isPending;

  const save = async () => {
    try {
      await update.mutateAsync({ id: doc.id, fields: values });
      toast.success('Draft saved');
    } catch (e) {
      toastError(e);
    }
  };

  const saveAndSend = async () => {
    const missing = missingRequiredFields(doc.type, values);
    if (missing.length) {
      setInvalid(TEMPLATE_FIELDS[doc.type].filter((f) => f.required && !(values[f.key] ?? '').trim()).map((f) => f.key));
      toast.error(`Complete the required fields: ${missing.join(', ')}`);
      return;
    }
    setInvalid([]);
    try {
      await update.mutateAsync({ id: doc.id, fields: values });
      await workflow.mutateAsync({ kind: 'submit', id: doc.id });
      toast.success('Sent to verification');
      router.push(`/drafts?select=${doc.id}`);
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-primary">
          <Link href={`/drafts?select=${doc.id}`}>
            <ArrowLeft /> Draft Documents
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Draft</h1>
        <span data-testid="draft-number" className="rounded-full bg-tone-blue-soft px-3 py-1 text-sm font-semibold">
          {doc.number}
        </span>
        <StatusPill status={doc.status} kind="document" />
        <span className="text-sm text-muted-foreground">
          {doc.requestNumber} · {doc.clientName} · {doc.version}
        </span>
      </div>

      {doc.status === 'REVISION' && doc.latestVerifierComment && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-tone-purple/30 bg-tone-purple-soft px-4 py-3 text-sm">
          <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-tone-purple" aria-hidden />
          <div>
            <p className="font-semibold">Returned by the verifier</p>
            <p className="mt-0.5">{doc.latestVerifierComment}</p>
          </div>
        </div>
      )}
      {!editable && (
        <div className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          This draft is {doc.status.toLowerCase().replace(/_/g, ' ')} and can no longer be edited.
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section aria-label="Draft form" className="rounded-xl border bg-card p-4 shadow-[0_1px_3px_rgb(15_23_42/0.05)]">
          <DraftEditorForm type={doc.type} values={values} onChange={setValues} disabled={!editable || busy} invalidKeys={invalid} />
          {editable && (
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" onClick={save} disabled={busy} className="gap-2 text-primary">
                <Save /> Save
              </Button>
              {can('document.submit') && (
                <Button onClick={saveAndSend} disabled={busy} className="gap-2">
                  <Send /> Save &amp; Send to Verification
                </Button>
              )}
            </div>
          )}
        </section>
        <section aria-label="Live preview" className="rounded-xl border bg-card p-4 shadow-[0_1px_3px_rgb(15_23_42/0.05)] xl:sticky xl:top-4">
          <h2 className="mb-3 text-sm font-bold">Live Preview</h2>
          <DocumentPreview type={doc.type} number={doc.number} fields={values} status={doc.status} />
        </section>
      </div>
    </div>
  );
}
