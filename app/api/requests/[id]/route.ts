import { withActor } from '@/server/handler';
import { getRequest } from '@/services/requests';

export const GET = withActor<{ id: string }>((actor, _req, { params }) => getRequest(actor, params.id));
