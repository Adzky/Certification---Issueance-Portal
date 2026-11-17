'use client';

import { Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useDocument } from '@/api-client/hooks';
import { Button } from '@/components/ui/button';
import { DocumentPreview } from './DocumentPreview';

/** Shell-less print view of a draft (`/drafts/[id]/print`); `?print=1` opens the print dialog once loaded. */
export function PrintView({ id }: { id: string }) {
  const { data: doc, error } = useDocument(id);
  const auto = useSearchParams().get('print') === '1';
  const printed = useRef(false);

  useEffect(() => {
    if (!doc || !auto || printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 600); // let the QR code render
    return () => clearTimeout(t);
  }, [doc, auto]);

  if (error) return <p className="p-10 text-center text-sm text-destructive">Draft not found.</p>;
  if (!doc) return <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>;

  return (
    <main className="mx-auto w-full max-w-[860px] p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold">{doc.number} — print view</h1>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer /> Print / Save as PDF
        </Button>
      </div>
      <DocumentPreview type={doc.type} number={doc.number} fields={doc.fields} status={doc.status} />
    </main>
  );
}
