'use client';

import { CheckCircle2, Hourglass, ShieldAlert, ShieldX, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { api, ApiError } from '@/api-client/client';
import type { PublicCertificate } from '@/contract/types';
import type { CertificateDisplayStatus } from '@/domain/types';
import { formatDateUtc } from '@/lib/format';
import { cn } from '@/lib/utils';

const BADGE: Record<CertificateDisplayStatus, { text: string; note: string; cls: string; icon: LucideIcon }> = {
  ACTIVE: { text: 'Valid — Active', note: 'This certificate is valid.', cls: 'bg-tone-green-soft text-tone-green ring-tone-green/30', icon: CheckCircle2 },
  IN_RENEWAL: { text: 'Valid — Active', note: 'This certificate is valid and is being renewed.', cls: 'bg-tone-green-soft text-tone-green ring-tone-green/30', icon: CheckCircle2 },
  EXPIRING: { text: 'Expiring', note: 'This certificate is valid but expires within 30 days.', cls: 'bg-tone-amber-soft text-tone-amber ring-tone-amber/30', icon: Hourglass },
  SUSPENDED: { text: 'Suspended', note: 'This certificate is currently suspended and not valid.', cls: 'bg-tone-red-soft text-tone-red ring-tone-red/30', icon: ShieldAlert },
  REVOKED: { text: 'Revoked', note: 'This certificate has been revoked and is not valid.', cls: 'bg-tone-red-soft text-tone-red ring-tone-red/30', icon: ShieldX },
  EXPIRED: { text: 'Expired', note: 'This certificate has expired.', cls: 'bg-tone-grey-soft text-tone-grey ring-tone-grey/30', icon: XCircle },
};

const TYPE_LABEL = { CERTIFICATE: 'Certificate', INSPECTION_REPORT: 'Inspection Report' } as const;

/** Public "is this certificate valid?" card (no session, no portal shell). */
export function PublicVerification({ certNo }: { certNo: string }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['public-certificate', certNo],
    queryFn: () => api.certificates.verifyPublic(certNo),
    retry: false,
  });
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-[#0B1F4D] text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="" className="h-9 w-auto rounded bg-white p-1" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-wide">JMU SERTIFIKASI</p>
            <p className="text-xs text-white/70">Certificate Verification</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {isPending ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Checking certificate…</p>
        ) : notFound ? (
          <div className="rounded-xl border bg-card p-8 text-center shadow-sm" role="status">
            <ShieldX className="mx-auto size-12 text-tone-red" aria-hidden />
            <h1 className="mt-3 text-xl font-bold">No certificate found with this number</h1>
            <p className="mt-1 break-all text-sm text-muted-foreground">{certNo}</p>
            <p className="mt-3 text-sm text-muted-foreground">Check the number or scan the QR code on the certificate again.</p>
          </div>
        ) : error || !data ? (
          <p className="py-16 text-center text-sm text-destructive">Could not verify this certificate right now. Please try again later.</p>
        ) : (
          <Card data={data} />
        )}
      </div>
    </main>
  );
}

function Card({ data }: { data: PublicCertificate }) {
  const badge = BADGE[data.displayStatus];
  const Icon = badge.icon;
  const rows: [string, string][] = [
    [TYPE_LABEL[data.type] + ' No.', data.number],
    ['Client', data.clientName],
    ['Scope of Certification', data.scopeName],
    ['Scheme / Standard', data.schemeLabel],
    ['Issue Date', formatDateUtc(data.issueDate)],
    ['Valid Until', formatDateUtc(data.validUntil)],
  ];
  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-label="Certificate verification result">
      <div className={cn('flex flex-col items-center gap-1 px-6 py-6 text-center ring-1 ring-inset', badge.cls)}>
        <Icon className="size-12" aria-hidden />
        <p data-testid="verification-status" className="text-3xl font-extrabold tracking-tight">
          {badge.text}
        </p>
        <p className="text-sm text-foreground/80">{badge.note}</p>
      </div>
      <div className="px-6 pt-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{TYPE_LABEL[data.type]}</p>
      </div>
      <dl className="px-6 pb-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 border-b py-2.5 last:border-b-0">
            <dt className="font-semibold">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
