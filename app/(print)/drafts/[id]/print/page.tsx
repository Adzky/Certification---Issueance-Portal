import { Suspense } from 'react';
import { PrintView } from '@/components/documents/PrintView';

/** Print view without the portal shell (sibling route group of `(portal)`); still guarded by proxy.ts. */
export default async function PrintDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PrintView id={id} />
    </Suspense>
  );
}
