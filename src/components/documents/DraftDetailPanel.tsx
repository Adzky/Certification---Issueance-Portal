'use client';

import { Download, FileText, Pencil, Send } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCan, useDocument, useWorkflowAction } from '@/api-client/hooks';
import type { DocumentDetail } from '@/contract/types';
import { DetailList, DetailPanel } from '@/components/common/DetailPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { toastError } from '@/components/common/notify';
import { StatusPill } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { missingRequiredFields, TEMPLATE_FIELDS } from '@/domain/templates';
import { formatDateTime } from '@/lib/format';
import { ReviewHistory } from '@/components/review/shared';
import { DocumentPreview } from './DocumentPreview';

const EDITABLE = ['IN_PROGRESS', 'REVISION'];
const TYPE_LABEL = { CERTIFICATE: 'Certificate', INSPECTION_REPORT: 'Inspection Report' } as const;
const cardClass = 'rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]';

/** Right-hand draft detail: Overview / Document Data / Revision History, preview and the draft actions. */
export function DraftDetailPanel({ documentId }: { documentId: string | null }) {
  const { data: doc, isPending, error } = useDocument(documentId);
  if (!documentId) {
    return (
      <div className={cardClass}>
        <EmptyState icon={FileText} title="Select a draft" description="Choose a row in the table to preview the document and see its history." />
      </div>
    );
  }
  if (isPending) return <div className={`${cardClass} p-8 text-center text-sm text-muted-foreground`}>Loading…</div>;
  if (error || !doc) {
    return (
      <div className={cardClass}>
        <EmptyState icon={FileText} title="Draft not found" description="It may have been removed or is outside your service scopes." />
      </div>
    );
  }
  return <DraftPanelBody doc={doc} />;
}

function DraftPanelBody({ doc }: { doc: DocumentDetail }) {
  const can = useCan();
  const workflow = useWorkflowAction();
  const editable = EDITABLE.includes(doc.status);

  const send = async () => {
    const missing = missingRequiredFields(doc.type, doc.fields);
    if (missing.length) {
      toast.error(`Complete the required fields first: ${missing.join(', ')}`);
      return;
    }
    try {
      await workflow.mutateAsync({ kind: 'submit', id: doc.id });
      toast.success('Sent to verification');
    } catch (e) {
      toastError(e);
    }
  };

  const overview = (
    <div className="space-y-4">
      <DetailList
        items={[
          { label: 'Request No.', value: doc.requestNumber },
          { label: 'Client', value: doc.clientName },
          { label: 'Document Type', value: `${TYPE_LABEL[doc.type]} (${doc.request.schemeLabel})` },
          { label: 'Object / Scope', value: doc.request.objectScope },
          { label: 'Version', value: doc.version },
          { label: 'Status', value: <StatusPill status={doc.status} kind="document" /> },
          { label: 'Last Updated', value: `${formatDateTime(doc.updatedAt)} by ${doc.preparedByName}` },
        ]}
      />
      <div>
        <h3 className="mb-2 text-sm font-bold">Document Preview{doc.status === 'SIGNED' ? '' : ' (Draft)'}</h3>
        <DocumentPreview type={doc.type} number={doc.number} fields={doc.fields} status={doc.status} />
      </div>
    </div>
  );

  const data = (
    <DetailList
      items={TEMPLATE_FIELDS[doc.type].map((f) => ({
        label: f.label,
        value: doc.fields[f.key]?.trim() ? <span className="whitespace-pre-wrap">{doc.fields[f.key]}</span> : <span className="text-muted-foreground">—</span>,
      }))}
    />
  );

  const actions = (
    <>
      <Button asChild variant="outline" className="gap-2 text-primary">
        <a href={`/drafts/${doc.id}/print?print=1`} target="_blank" rel="noreferrer">
          <Download /> Download Draft
        </a>
      </Button>
      {can('document.edit') && (
        <Button asChild={editable} variant="outline" className="gap-2 text-primary" disabled={!editable}>
          {editable ? (
            <Link href={`/drafts/${doc.id}/edit`}>
              <Pencil /> Edit Draft
            </Link>
          ) : (
            <span>
              <Pencil /> Edit Draft
            </span>
          )}
        </Button>
      )}
      {can('document.submit') && (
        <Button onClick={send} disabled={!editable || workflow.isPending} className="gap-2">
          <Send /> Send to Verification
        </Button>
      )}
    </>
  );

  return (
    <DetailPanel
      title="Draft Detail"
      badge={doc.number}
      tabs={[
        { key: 'overview', label: 'Overview', content: overview },
        { key: 'data', label: 'Document Data', content: data },
        { key: 'history', label: 'Revision History', content: <ReviewHistory doc={doc} /> },
      ]}
      actions={actions}
    />
  );
}
