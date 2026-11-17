import type { Metadata } from 'next';
import { PublicVerification } from '@/components/certificates/PublicVerification';

export const metadata: Metadata = { title: 'Certificate Verification | JMU Sertifikasi' };

/** Public QR target: no portal shell, no session. */
export default async function VerifyPage({ params }: { params: Promise<{ certNo: string }> }) {
  const { certNo } = await params;
  return <PublicVerification certNo={decodeURIComponent(certNo)} />;
}
