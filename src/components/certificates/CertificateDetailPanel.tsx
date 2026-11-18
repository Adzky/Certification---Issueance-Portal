'use client';

import { Award, Copy, Download, Printer, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAudit, useCertificate, useDocument, useRequest } from '@/api-client/hooks';
import { api } from '@/api-client/client';
import type { CertificateDetail } from '@/contract/types';
import { publicBaseUrl, verificationUrl } from '@/domain/verification';
import { DetailList, DetailPanel } from '@/components/common/DetailPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusPill } from '@/components/common/StatusPill';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatDateUtc } from '@/lib/format';
import { LifecycleActions } from './LifecycleActions';

const cardClass = 'rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]';
const TYPE_LABEL = { CERTIFICATE: 'Certificate', INSPECTION_REPORT: 'Inspection Report' } as const;

const AUDIT_LABEL: Record<string, string> = {
  'certificate.issue': 'Certificate issued',
  'certificate.suspend': 'Suspended',
  'certificate.reinstate': 'Reinstated',
  'certificate.revoke': 'Revoked',
};

/** Copies text; when the Clipboard API is unavailable or refused, shows the text in a toast instead. */
export async function copyText(text: string, what: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.info(`Copy this ${what.toLowerCase()} manually`, { description: text, duration: 10_000 });
  }
}

function months(from: string, to: string): string {
  const a = new Date(from);
  const b = new Date(to);
  const m = Math.round((b.getTime() + 86_400_000 - a.getTime()) / (30.4375 * 86_400_000));
  return m % 12 === 0 ? `${m / 12} Year${m === 12 ? '' : 's'}` : `${m} Months`;
}

/** Right-hand certificate detail: Overview (with QR preview) / Scope / Lifecycle / Documents / History. */
export function CertificateDetailPanel({ certificateId }: { certificateId: string | null }) {
  const { data: cert, isPending, error } = useCertificate(certificateId);
  if (!certificateId) {
    return (
      <div className={cardClass}>
        <EmptyState icon={Award} title="Select a certificate" description="Choose a row in the table to see its details, preview and lifecycle." />
      </div>
    );
  }
  if (isPending) return <div className={`${cardClass} p-8 text-center text-sm text-muted-foreground`}>Loading…</div>;
  if (error || !cert) {
    return (
      <div className={cardClass}>
        <EmptyState icon={Award} title="Certificate not found" description="It may have been removed or is outside your service scopes." />
      </div>
    );
  }
  return <CertificatePanelBody key={cert.id} cert={cert} />;
}

function CertificatePanelBody({ cert }: { cert: CertificateDetail }) {
  const [tab, setTab] = useState('overview');
  const { data: doc } = useDocument(cert.documentId);
  const { data: request } = useRequest(cert.requestId);
  const { data: audit } = useAudit({ entityType: 'CERTIFICATE', entityId: cert.id, pageSize: 50 });

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = verificationUrl(cert.number, publicBaseUrl(process.env.PUBLIC_BASE_URL, origin));
  const landscape = cert.type === 'CERTIFICATE';
  const fields = {
    ...(doc?.fields ?? {}),
    clientName: cert.clientName,
    clientAddress: cert.clientAddress ?? doc?.fields.clientAddress ?? '',
  };

  const print = () => {
    // The preview lives on the Overview tab: make sure it is on screen before printing.
    setTab('overview');
    setTimeout(() => window.print(), 250);
  };

  const overview = (
    <div className="space-y-4">
      <DetailList
        items={[
          { label: 'Certificate No.', value: <span className="font-semibold">{cert.number}</span> },
          { label: 'Client', value: cert.clientName },
          { label: 'Service Scope', value: cert.scopeName },
          { label: 'Scheme / Standard', value: cert.schemeLabel },
          { label: 'Issue Date', value: formatDateUtc(cert.issueDate) },
          { label: 'Valid Until', value: formatDateUtc(cert.validUntil) },
          { label: 'Status', value: <StatusPill status={cert.displayStatus} kind="certificate" /> },
          { label: 'Terms', value: months(cert.issueDate, cert.validUntil) },
          {
            label: 'Verification URL',
            value: (
              <span className="flex items-start gap-1.5">
                <a href={url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-xs text-primary underline underline-offset-2" data-testid="verification-url">
                  {url}
                </a>
                <button
                  type="button"
                  aria-label="Copy verification URL"
                  title="Copy verification URL"
                  onClick={() => copyText(url, 'Verification URL')}
                  className="shrink-0 rounded p-1 text-primary hover:bg-accent"
                >
                  <Copy className="size-4" />
                </button>
              </span>
            ),
          },
        ]}
      />
      <div>
        <h3 className="mb-2 text-sm font-bold">Certificate Preview</h3>
        <style>{`@media print { @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 8mm; } }`}</style>
        <div data-print-area>
          <DocumentPreview type={cert.type} number={cert.number} certificateNumber={cert.number} fields={fields} status="SIGNED" qrUrl={url} />
        </div>
      </div>
    </div>
  );

  const scope = (
    <DetailList
      items={[
        { label: 'Document Type', value: TYPE_LABEL[cert.type] },
        { label: 'Service Scope', value: cert.scopeName },
        { label: 'Scheme / Standard', value: cert.schemeLabel },
        { label: 'Object / Scope', value: cert.objectScope },
        { label: 'Scope Statement', value: doc?.fields.scopeStatement?.trim() || <span className="text-muted-foreground">—</span> },
        { label: 'Sites', value: doc?.fields.sites?.trim() || <span className="text-muted-foreground">—</span> },
        { label: 'Client Address', value: cert.clientAddress || <span className="text-muted-foreground">—</span> },
      ]}
    />
  );

  const lifecycle = (
    <div className="space-y-4">
      <LifecycleActions certificate={cert} />
      {cert.statusReason && (
        <p className="rounded-lg border border-tone-red/30 bg-tone-red-soft px-3 py-2 text-sm">
          <span className="font-semibold">Reason: </span>
          {cert.statusReason}
        </p>
      )}
      {audit && audit.items.length > 0 ? (
        <ol className="space-y-3 text-sm" aria-label="Lifecycle events">
          {audit.items.map((e) => (
            <li key={e.id} className="border-l-2 border-primary/30 pl-3">
              <p className="font-medium">{AUDIT_LABEL[e.action] ?? e.action}</p>
              {e.comment && <p>{e.comment}</p>}
              <p className="text-xs text-muted-foreground">
                {e.actorName ?? 'System'} · {formatDateTime(e.at)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">{audit ? 'No lifecycle events visible to you.' : 'Loading…'}</p>
      )}
    </div>
  );

  const documents = (
    <DetailList
      items={[
        { label: 'Source Draft', value: cert.documentNumber },
        { label: 'Request No.', value: cert.requestNumber },
        {
          label: 'Issued PDF',
          value: (
            <a href={api.certificates.pdfUrl(cert.id)} className="text-primary underline underline-offset-2">
              {cert.number}.pdf
            </a>
          ),
        },
      ]}
    />
  );

  const history = request?.timeline.length ? (
    <ol className="space-y-3 text-sm">
      {request.timeline.map((t) => (
        <li key={t.id} className="border-l-2 border-primary/30 pl-3">
          <p className="font-medium">{t.comment ?? t.action}</p>
          <p className="text-xs text-muted-foreground">
            {t.actorName ?? 'System'} · {formatDateTime(t.at)}
          </p>
        </li>
      ))}
    </ol>
  ) : (
    <p className="py-6 text-center text-sm text-muted-foreground">{request ? 'No history yet.' : 'Loading…'}</p>
  );

  const actions = (
    <>
      <Button asChild className="gap-2">
        <a href={api.certificates.pdfUrl(cert.id)} download={`${cert.number}.pdf`}>
          <Download /> Download Certificate
        </a>
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => copyText(url, 'Verification link')}>
        <Share2 /> Share Verification Link
      </Button>
      <Button variant="outline" className="gap-2" onClick={print}>
        <Printer /> Print
      </Button>
    </>
  );

  return (
    <DetailPanel
      title="Certificate Detail"
      icon={Award}
      badge={cert.number}
      activeTab={tab}
      onTabChange={setTab}
      tabs={[
        { key: 'overview', label: 'Overview', content: overview },
        { key: 'scope', label: 'Scope', content: scope },
        { key: 'lifecycle', label: 'Lifecycle', content: lifecycle },
        { key: 'documents', label: 'Documents', content: documents },
        { key: 'history', label: 'History', content: history },
      ]}
      actions={actions}
    />
  );
}
