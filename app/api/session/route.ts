import { errorResponse, toErrorResponse, withActor } from '@/server/handler';
import { loginBody, parseBody } from '@/server/schemas';
import { clearSession, writeSession } from '@/server/session';
import { loadActor } from '@/services/registrations';
import { getSessionInfo } from '@/services/users';

export const GET = withActor((actor) => getSessionInfo(actor));

/** Demo login: pick a user + role. Only ACTIVE or RESTRICTED assignments may sign in. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { userId, role } = await parseBody(req, loginBody);
    const actor = await loadActor(userId, role);
    if (!actor || (actor.assignmentStatus !== 'ACTIVE' && actor.assignmentStatus !== 'RESTRICTED')) {
      return errorResponse('FORBIDDEN', 'This user has no active authorisation for that role');
    }
    const headers = new Headers();
    await writeSession(req, headers, { userId, role });
    return Response.json(await getSessionInfo(actor), { headers });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** Logout: clears the session cookie. Always succeeds. */
export async function DELETE(req: Request): Promise<Response> {
  try {
    const headers = new Headers();
    await clearSession(req, headers);
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return toErrorResponse(e);
  }
}
