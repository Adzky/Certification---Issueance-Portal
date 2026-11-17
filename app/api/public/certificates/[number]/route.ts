import { DomainError } from '@/domain/errors';
import { withActor } from '@/server/handler';
import { getPublicCertificate } from '@/services/certificates';

/** Public verification lookup (QR target). No session required. */
export const GET = withActor<{ number: string }>(
  async (_actor, _req, { params }) => {
    const cert = await getPublicCertificate(params.number);
    if (!cert) throw new DomainError('NOT_FOUND', 'Certificate not found');
    return cert;
  },
  { public: true },
);
