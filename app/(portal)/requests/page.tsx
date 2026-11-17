import { Suspense } from 'react';
import { RequestsView } from '@/components/requests/RequestsView';

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsView />
    </Suspense>
  );
}
