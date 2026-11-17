import { withActor } from '@/server/handler';
import { dashboardQuerySchema, parseQuery } from '@/server/schemas';
import { getDashboard } from '@/services/dashboard';

export const GET = withActor((actor, req) => getDashboard(actor, new Date(), parseQuery(req, dashboardQuerySchema)));
