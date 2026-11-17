import { withActor } from '@/server/handler';
import { listLoginOptions } from '@/services/registrations';

/** Public: users per role for the demo login picker. */
export const GET = withActor(() => listLoginOptions(), { public: true });
