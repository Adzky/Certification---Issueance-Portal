import { withActor } from '@/server/handler';
import { parseBody, reasonBody } from '@/server/schemas';
import { revokeCertificate } from '@/services/certificates';

export const POST = withActor<{ id: string }>(async (actor, req, { params }) =>
  revokeCertificate(actor, params.id, await parseBody(req, reasonBody)),
);
