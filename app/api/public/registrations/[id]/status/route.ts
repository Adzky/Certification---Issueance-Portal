import { withActor } from '@/server/handler';
import { getRegistrationStatus } from '@/services/registrations';

/** Public: lets an applicant follow their registration by application id. */
export const GET = withActor<{ id: string }>((_actor, _req, { params }) => getRegistrationStatus(params.id), {
  public: true,
});
