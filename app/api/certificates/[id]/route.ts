import { withActor } from '@/server/handler';
import { getCertificate } from '@/services/certificates';

export const GET = withActor<{ id: string }>((actor, _req, { params }) => getCertificate(actor, params.id));
