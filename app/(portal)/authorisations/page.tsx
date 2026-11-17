import { Suspense } from 'react';
import { AuthorisationsView } from '@/components/authorisations/AuthorisationsView';

export default function AuthorisationsPage() {
  return (
    <Suspense>
      <AuthorisationsView />
    </Suspense>
  );
}
