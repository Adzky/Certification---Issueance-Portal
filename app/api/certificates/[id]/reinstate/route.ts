import { withActor } from '@/server/handler';
import { reinstateCertificate } from '@/services/certificates';

export const POST = withActor<{ id: string }>((actor, _req, { params }) => reinstateCertificate(actor, params.id));
