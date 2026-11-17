import { withActor } from '@/server/handler';
import { certificateListQuerySchema, parseQuery } from '@/server/schemas';
import { listCertificates } from '@/services/certificates';

export const GET = withActor((actor, req) => listCertificates(actor, parseQuery(req, certificateListQuerySchema)));
