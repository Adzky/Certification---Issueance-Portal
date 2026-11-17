import { Suspense } from 'react';
import { AuditView } from '@/components/audit/AuditView';

export default function AuditPage() {
  return (
    <Suspense>
      <AuditView />
    </Suspense>
  );
}
