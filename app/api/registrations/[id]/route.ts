import { withActor } from '@/server/handler';
import { getRegistration } from '@/services/registrations';

export const GET = withActor<{ id: string }>((actor, _req, { params }) => getRegistration(actor, params.id));
