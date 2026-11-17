import { withActor } from '@/server/handler';
import { signDocument } from '@/services/documents';

export const POST = withActor<{ id: string }>((actor, _req, { params }) => signDocument(actor, params.id));
