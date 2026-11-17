import { withActor } from '@/server/handler';
import { parseBody, returnBody } from '@/server/schemas';
import { returnDocument } from '@/services/documents';

export const POST = withActor<{ id: string }>(async (actor, req, { params }) =>
  returnDocument(actor, params.id, await parseBody(req, returnBody)),
);
