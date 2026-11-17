import { withActor } from '@/server/handler';
import { parseBody, updateAssignmentBody } from '@/server/schemas';
import { updateAssignment } from '@/services/users';

export const PATCH = withActor<{ id: string }>(async (actor, req, { params }) =>
  updateAssignment(actor, params.id, await parseBody(req, updateAssignmentBody)),
);
