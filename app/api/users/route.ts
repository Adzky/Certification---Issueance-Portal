import { withActor } from '@/server/handler';
import { listUsers } from '@/services/users';

export const GET = withActor((actor) => listUsers(actor));
