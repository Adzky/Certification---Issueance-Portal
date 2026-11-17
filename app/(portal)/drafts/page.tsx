import { Suspense } from 'react';
import { DraftsView } from '@/components/documents/DraftsView';

export default function DraftsPage() {
  return (
    <Suspense>
      <DraftsView />
    </Suspense>
  );
}
