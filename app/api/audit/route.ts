import { withActor } from '@/server/handler';
import { auditListQuerySchema, parseQuery } from '@/server/schemas';
import { listAudit } from '@/services/auditQueries';

export const GET = withActor((actor, req) => listAudit(actor, parseQuery(req, auditListQuerySchema)));
