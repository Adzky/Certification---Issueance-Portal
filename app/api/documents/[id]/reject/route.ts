import { withActor } from '@/server/handler';
import { parseBody, reasonBody } from '@/server/schemas';
import { rejectDocument } from '@/services/documents';

export const POST = withActor<{ id: string }>(async (actor, req, { params }) =>
  rejectDocument(actor, params.id, await parseBody(req, reasonBody)),
);
