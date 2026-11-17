import { created, withActor } from '@/server/handler';
import { createRequestBody, listQuerySchema, parseBody, parseQuery } from '@/server/schemas';
import { createRequest, listRequests } from '@/services/requests';

export const GET = withActor((actor, req) => listRequests(actor, parseQuery(req, listQuerySchema)));

export const POST = withActor(async (actor, req) => created(await createRequest(actor, await parseBody(req, createRequestBody))));
