import { withActor } from '@/server/handler';
import { parseBody, verifyBody } from '@/server/schemas';
import { verifyDocument } from '@/services/documents';

export const POST = withActor<{ id: string }>(async (actor, req, { params }) =>
  verifyDocument(actor, params.id, await parseBody(req, verifyBody)),
);
