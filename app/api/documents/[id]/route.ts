import { withActor } from '@/server/handler';
import { parseBody, updateDocumentBody } from '@/server/schemas';
import { getDocument, updateDocumentFields } from '@/services/documents';

export const GET = withActor<{ id: string }>((actor, _req, { params }) => getDocument(actor, params.id));

export const PATCH = withActor<{ id: string }>(async (actor, req, { params }) => {
  const { fields } = await parseBody(req, updateDocumentBody);
  return updateDocumentFields(actor, params.id, fields);
});
