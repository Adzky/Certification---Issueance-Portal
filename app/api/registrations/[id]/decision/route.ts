import { withActor } from '@/server/handler';
import { decisionBody, parseBody } from '@/server/schemas';
import { decideRegistration } from '@/services/registrations';

export const POST = withActor<{ id: string }>(async (actor, req, { params }) =>
  decideRegistration(actor, params.id, await parseBody(req, decisionBody)),
);
