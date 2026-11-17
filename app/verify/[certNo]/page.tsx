import type { Metadata } from 'next';
import { PublicVerification } from '@/components/certificates/PublicVerification';
import { safeDecode } from '@/lib/safeDecode';

export const metadata: Metadata = { title: 'Certificate Verification | JMU Sertifikasi' };

/** Public QR target: no portal shell, no session. */
export default async function VerifyPage({ params }: { params: Promise<{ certNo: string }> }) {
  const { certNo } = await params;
  // A malformed escape must show the not-found card, not throw a 500.
  return <PublicVerification certNo={safeDecode(certNo)} />;
}
