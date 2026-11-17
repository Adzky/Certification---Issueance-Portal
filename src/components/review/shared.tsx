'use client';

import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDocument } from '@/api-client/hooks';
import type { DocumentDetail } from '@/contract/types';
import { DetailList } from '@/components/common/DetailPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusPill } from '@/components/common/StatusPill';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { TEMPLATE_FIELDS } from '@/domain/templates';
import { formatDateTime } from '@/lib/format';

export const TYPE_LABEL = { CERTIFICATE: 'Certificate', INSPECTION_REPORT: 'Inspection Report' } as const;
export const cardClass = 'rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]';

/** Loads the selected document and renders the empty / loading / not-found states around `children`. */
export function PanelLoader({
  documentId,
  emptyTitle,
  children,
}: {
  documentId: string | null;
  emptyTitle: string;
  children: (doc: DocumentDetail) => ReactNode;
}) {
  const { data: doc, isPending, error } = useDocument(documentId);
  if (!documentId) {
    return (
      <div className={cardClass}>
        <EmptyState icon={FileText} title={emptyTitle} description="Choose a row in the table to preview the document and take action." />
      </div>
    );
  }
  if (isPending) return <div className={`${cardClass} p-8 text-center text-sm text-muted-foreground`}>Loading…</div>;
  if (error || !doc) {
    return (
      <div className={cardClass}>
        <EmptyState icon={FileText} title="Document not found" description="It may have been removed or is outside your service scopes." />
      </div>
    );
  }
  return <>{children(doc)}</>;
}

/** Key facts + document preview (+ optional extra block between them). */
export function DocumentOverview({ doc, children }: { doc: DocumentDetail; children?: ReactNode }) {
  return (
    <div className="space-y-4">
      <DetailList
        items={[
          { label: 'Request No.', value: doc.requestNumber },
          { label: 'Client', value: doc.clientName },
          { label: 'Document Type', value: `${TYPE_LABEL[doc.type]} (${doc.request.schemeLabel})` },
          { label: 'Object / Scope', value: doc.request.objectScope },
          { label: 'Version', value: doc.version },
          { label: 'Prepared By', value: doc.preparedByName },
          { label: 'Status', value: <StatusPill status={doc.status} kind="document" /> },
        ]}
      />
      {children}
      <div>
        <h3 className="mb-2 text-sm font-bold">Document Preview</h3>
        <DocumentPreview type={doc.type} number={doc.number} fields={doc.fields} status={doc.status} />
      </div>
    </div>
  );
}

/** Field-by-field document data. */
export function DocumentData({ doc }: { doc: DocumentDetail }) {
  return (
    <DetailList
      items={TEMPLATE_FIELDS[doc.type].map((f) => ({
        label: f.label,
        value: doc.fields[f.key]?.trim() ? (
          <span className="whitespace-pre-wrap">{doc.fields[f.key]}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      }))}
    />
  );
}

/** Verifier comments (newest first) and the signatory's rejection reason. */
export function ReviewHistory({ doc }: { doc: DocumentDetail }) {
  if (doc.verifications.length === 0 && !doc.rejectionReason) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No verifier comments or rejection reasons yet.</p>;
  }
  return (
    <ol className="space-y-3 text-sm">
      {doc.rejectionReason && (
        <li className="rounded-lg border border-tone-red/30 bg-tone-red-soft px-3 py-2">
          <p className="font-semibold text-tone-red">Rejected by signatory</p>
          <p className="mt-0.5">{doc.rejectionReason}</p>
        </li>
      )}
      {[...doc.verifications].reverse().map((v) => (
        <li key={v.id} className="border-l-2 border-primary/30 pl-3">
          <p className="flex items-center gap-2 font-medium">
            <StatusPill status={v.outcome === 'APPROVED' ? 'APPROVED' : 'REVISION'} label={v.outcome === 'APPROVED' ? 'Approved' : 'Returned'} />
            {v.verifierName}
          </p>
          {v.comment && <p className="mt-1">{v.comment}</p>}
          <p className="text-xs text-muted-foreground">{formatDateTime(v.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
