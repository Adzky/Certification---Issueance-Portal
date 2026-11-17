import { withActor } from '@/server/handler';
import { listPublicScopes } from '@/services/reference';

/** Public: service scopes an applicant can pick in onboarding step 3. */
export const GET = withActor(() => listPublicScopes(), { public: true });
