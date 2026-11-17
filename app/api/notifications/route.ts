import { withActor } from '@/server/handler';
import { listNotifications } from '@/services/notifications';

export const GET = withActor((actor) => listNotifications(actor));
