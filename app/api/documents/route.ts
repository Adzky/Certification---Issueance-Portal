import { withActor } from '@/server/handler';
import { documentListQuerySchema, parseQuery } from '@/server/schemas';
import { listDocuments } from '@/services/documents';

export const GET = withActor((actor, req) => listDocuments(actor, parseQuery(req, documentListQuerySchema)));
