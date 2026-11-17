import { Suspense } from 'react';
import { CertificatesView } from '@/components/certificates/CertificatesView';

export default function CertificatesPage() {
  return (
    <Suspense>
      <CertificatesView />
    </Suspense>
  );
}
