import { created, withActor } from '@/server/handler';
import { prepareDocument } from '@/services/documents';

export const POST = withActor<{ id: string }>(async (actor, _req, { params }) => created(await prepareDocument(actor, params.id)));
