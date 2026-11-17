import { withActor } from '@/server/handler';
import { getReference } from '@/services/reference';

export const GET = withActor(() => getReference());
