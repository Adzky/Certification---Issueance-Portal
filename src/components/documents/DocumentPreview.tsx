'use client';

import QRCode from 'qrcode';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DocumentStatus, DocumentType } from '@/domain/types';
import { cn } from '@/lib/utils';

export interface DocumentPreviewProps {
  type: DocumentType;
  /** Draft number (shown as "No." until a certificate number exists). */
  number: string;
  fields: Record<string, string>;
  status: DocumentStatus;
  certificateNumber?: string | null;
  /** Verification URL encoded in the QR code. */
  qrUrl?: string;
  className?: string;
}

/** Fixed "paper" size in CSS px; the preview is scaled to fit its container. */
const PAPER = {
  CERTIFICATE: { w: 800, h: 566 },
  INSPECTION_REPORT: { w: 640, h: 820 },
} as const;

const dash = (v: string | undefined) => (v && v.trim() ? v : '—');

function formatFieldDate(v: string | undefined): string {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function Qr({ url, size }: { url: string; size: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 0, width: size * 2, errorCorrectionLevel: 'M' })
      .then((data) => live && setSrc(data))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [url, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR code" width={size} height={size} /> : <span style={{ width: size, height: size }} className="inline-block bg-muted" />;
}

function Header({ right }: { right: ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" alt="JMU Sertifikasi" className="h-11 w-auto" />
      </div>
      <div className="text-right text-[13px] leading-tight font-semibold">{right}</div>
    </div>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      <span className="-rotate-[28deg] text-[150px] font-black tracking-widest text-red-500/15 select-none">DRAFT</span>
    </div>
  );
}

function Certificate({ number, fields, status, certificateNumber, qrUrl }: DocumentPreviewProps) {
  const no = certificateNumber ?? number;
  return (
    <div className="relative h-full w-full bg-white p-3.5">
      <div className="relative h-full border-[3px] border-[#1d4ed8]/80 p-1">
        <div className="relative flex h-full flex-col border border-[#c9a24a] px-12 py-8">
          <Header
            right={
              <>
                <p>Management System</p>
                <p>Certification</p>
              </>
            }
          />
          <div className="mt-3 text-center">
            <h3 className="text-[40px] leading-none font-extrabold tracking-wide text-[#0b1f4d]">CERTIFICATE</h3>
            <p className="mt-1.5 text-[15px] font-bold">No. {no}</p>
            <p className="mt-4 text-[14px]">This is to certify that</p>
            <p className="mt-1.5 text-[30px] leading-tight font-bold">{dash(fields.clientName)}</p>
            <p className="mt-1 text-[13px] text-slate-600">{fields.clientAddress?.trim() || ''}</p>
            <p className="mt-3 text-[13px]">has been assessed and found to conform to the requirements of</p>
            <p className="mt-1.5 text-[34px] leading-tight font-extrabold text-[#0b1f4d]">{dash(fields.standard)}</p>
            <p className="mx-auto mt-1.5 max-w-[560px] text-[14px] leading-snug">{dash(fields.scopeStatement)}</p>
            <p className="mx-auto mt-2 max-w-[560px] text-[12px] leading-snug text-slate-600">
              <span className="font-semibold">Sites:</span> {dash(fields.sites)}
              {'  ·  '}
              <span className="font-semibold">Audit date:</span> {formatFieldDate(fields.auditDate)}
            </p>
          </div>
          <div className="mt-auto flex items-end justify-between">
            <Qr url={qrUrl ?? `https://verify.jmusertifikasi.example/${no}`} size={84} />
            <div className="w-56 text-center text-[12px]">
              <div className="mb-1 h-12" />
              <div className="border-t border-slate-700 pt-1 font-semibold">Certification Director</div>
            </div>
          </div>
        </div>
      </div>
      {status !== 'SIGNED' && <Watermark />}
    </div>
  );
}

function InspectionReport({ number, fields, status, qrUrl }: DocumentPreviewProps) {
  const rows: [string, string][] = [
    ['Client', dash(fields.clientName)],
    ['Inspected object', dash(fields.objectDescription)],
    ['Inspection location', dash(fields.inspectionLocation)],
    ['Inspection date', formatFieldDate(fields.inspectionDate)],
    ['Inspection method', dash(fields.method)],
    ['Findings', dash(fields.findings)],
    ['Conclusion', dash(fields.conclusion)],
  ];
  return (
    <div className="relative h-full w-full bg-white p-3.5">
      <div className="relative flex h-full flex-col border-[3px] border-[#1d4ed8]/80 px-9 py-7">
        <Header
          right={
            <>
              <p>Inspection Report</p>
              {status !== 'SIGNED' && <p className="font-normal text-slate-500">(Draft)</p>}
            </>
          }
        />
        <div className="mt-5 text-center">
          <h3 className="text-[32px] leading-none font-extrabold tracking-wide text-[#0b1f4d]">INSPECTION REPORT</h3>
          <p className="mt-1.5 text-[14px] font-bold">No. {number}</p>
        </div>
        <dl className="mt-6 flex-1 text-[13px] leading-snug">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b border-slate-200 py-2">
              <dt className="font-semibold text-slate-700">{k}</dt>
              <dd className="break-words whitespace-pre-wrap">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-end justify-between">
          <Qr url={qrUrl ?? `https://verify.jmusertifikasi.example/${number}`} size={72} />
          <div className="w-52 text-center text-[12px]">
            <div className="mb-1 h-10" />
            <div className="border-t border-slate-700 pt-1 font-semibold">Certification Director</div>
          </div>
        </div>
      </div>
      {status !== 'SIGNED' && <Watermark />}
    </div>
  );
}

/** Certificate (image 9 style) or inspection report with a diagonal DRAFT watermark unless SIGNED. Scales to its container. */
export function DocumentPreview(props: DocumentPreviewProps) {
  const { type, className } = props;
  const paper = PAPER[type];
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / paper.w || 0.5);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paper.w]);

  return (
    <div
      ref={box}
      role="group"
      aria-label={`Document preview: ${type === 'CERTIFICATE' ? 'certificate' : 'inspection report'} ${props.number}`}
      data-testid="document-preview"
      className={cn('relative w-full overflow-hidden rounded-sm border bg-white shadow-sm', className)}
      style={{ height: paper.h * scale }}
    >
      <div style={{ width: paper.w, height: paper.h, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="absolute top-0 left-0">
        {type === 'CERTIFICATE' ? <Certificate {...props} /> : <InspectionReport {...props} />}
      </div>
    </div>
  );
}
