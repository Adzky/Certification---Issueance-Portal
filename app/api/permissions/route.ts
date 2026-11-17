import { ROLE_ACTIONS, ROLE_LABEL, ROLES } from '@/domain/permissions';
import type { Action } from '@/domain/types';
import type { PermissionsMatrix } from '@/contract/types';
import { withActor } from '@/server/handler';

/** The role -> action matrix (read-only settings view). */
export const GET = withActor(async (): Promise<PermissionsMatrix> => {
  const actions = [...new Set(ROLES.flatMap((r) => ROLE_ACTIONS[r]))] as Action[];
  return { roles: ROLES.map((role) => ({ role, label: ROLE_LABEL[role], actions: [...ROLE_ACTIONS[role]] })), actions };
});
