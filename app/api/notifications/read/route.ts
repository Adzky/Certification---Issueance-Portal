import { withActor } from '@/server/handler';
import { markReadBody, parseBody } from '@/server/schemas';
import { markNotificationsRead } from '@/services/notifications';

export const POST = withActor(async (actor, req) => markNotificationsRead(actor, await parseBody(req, markReadBody)));
