import { withActor } from '@/server/handler';
import { getDashboard } from '@/services/dashboard';

export const GET = withActor((actor) => getDashboard(actor, new Date()));
