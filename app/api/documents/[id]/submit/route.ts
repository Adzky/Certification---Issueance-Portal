import { withActor } from '@/server/handler';
import { submitDocument } from '@/services/documents';

export const POST = withActor<{ id: string }>((actor, _req, { params }) => submitDocument(actor, params.id));
