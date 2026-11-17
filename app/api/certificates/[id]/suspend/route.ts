import { withActor } from '@/server/handler';
import { parseBody, reasonBody } from '@/server/schemas';
import { suspendCertificate } from '@/services/certificates';

export const POST = withActor<{ id: string }>(async (actor, req, { params }) =>
  suspendCertificate(actor, params.id, await parseBody(req, reasonBody)),
);
